"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Calendar, Plus, Folder, FileText, Video, Layout } from "lucide-react";
import styles from "./CreateCourseStep3.module.css";

export interface StarterItem {
  id: string;
  type: "folder" | "youtube" | "self-hosted" | "document" | string;
  title: string;
  url?: string;
  items?: StarterItem[]; 
}

export interface StarterMainTopic {
  id: string;
  title: string;
  subTopics: StarterItem[];
  source: "starter" | "library" | "custom";
}

interface LibraryNode {
  id: string;
  title: string;
  type: "folder" | "youtube" | "self-hosted" | "document";
  url: string | null;
  duration: string | null;
  parentId: string | null;
}

function CreateCourseStep3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [topicOptions, setTopicOptions] = useState<StarterMainTopic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [expandedTopics, setExpandedTopics] = useState<string[]>([]);
  
  // Replace excludedVideoIndices with excludedItemIds set
  const [excludedItemIds, setExcludedItemIds] = useState<Record<string, boolean>>({});
  // Track expanded state for all nesting levels
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  // Publish frequency controls
  const [publishFreqMode, setPublishFreqMode] = useState<"interval" | "dayOfWeek">("interval");
  const [publishIntervalDays, setPublishIntervalDays] = useState(7);
  const [publishDaysOfWeek, setPublishDaysOfWeek] = useState<number[]>([0]); // 0 = Sunday
  const [publishStartDate, setPublishStartDate] = useState("");
  
  // Manual date overrides for first-level items OR child items
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  
  // Inline add-item form: tracks which parent item currently has the form open
  const [addInlineItemId, setAddInlineItemId] = useState<string | null>(null);
  const [inlineItemType, setInlineItemType] = useState<"folder" | "youtube" | "self-hosted">("youtube");
  const [inlineItemTitle, setInlineItemTitle] = useState("");
  const [inlineItemUrl, setInlineItemUrl] = useState("");
  
  // Custom topic creation
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicItems, setNewTopicItems] = useState<StarterItem[]>([]);
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoType, setNewVideoType] = useState<"youtube" | "self-hosted">("youtube");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const collectItemsRecursively = (nodes: LibraryNode[], parentId: string): StarterItem[] => {
    const children = nodes.filter(n => n.parentId === parentId);
    return children.map(child => {
      if (child.type === "folder") {
        return {
          id: child.id,
          type: "folder",
          title: child.title,
          url: child.url || undefined,
          items: collectItemsRecursively(nodes, child.id)
        };
      } else {
        return {
          id: child.id,
          type: child.type,
          title: child.title,
          url: child.url || undefined
        };
      }
    });
  };

  const buildHierarchyFromLibraryNodes = (nodes: LibraryNode[]): StarterMainTopic[] => {
    const topLevelFolders = nodes.filter(n => !n.parentId && n.type === "folder");
    
    return topLevelFolders.map(folder => {
      const subTopics = collectItemsRecursively(nodes, folder.id);
      
      const directChildren = nodes.filter(n => n.parentId === folder.id && n.type !== "folder");
      if (directChildren.length > 0) {
        const directItems: StarterItem[] = directChildren.map(child => ({
          id: child.id,
          type: child.type,
          title: child.title,
          url: child.url || undefined,
        }));
        subTopics.push(...directItems);
      }
      
      return {
        id: folder.id,
        title: folder.title,
        subTopics,
        source: "library",
      };
    });
  };

  // Helper to extract ALL child IDs recursively
  const getAllChildIds = (item: StarterItem, ids: string[] = []) => {
    ids.push(item.id);
    if (item.items) {
      item.items.forEach(child => getAllChildIds(child, ids));
    }
    return ids;
  };

  const toggleTopicSelection = (mainTopicId: string) => {
    const topic = topicOptions.find(t => t.id === mainTopicId);
    if (!topic) return;

    const subTopicIds = topic.subTopics.map(st => st.id);
    const allSelected = selectedTopicIds.includes(mainTopicId) && subTopicIds.every(id => selectedTopicIds.includes(id));

    if (allSelected) {
      setSelectedTopicIds(prev => prev.filter(id => id !== mainTopicId && !subTopicIds.includes(id)));
    } else {
      const uniqueIds = new Set([...selectedTopicIds, mainTopicId, ...subTopicIds]);
      setSelectedTopicIds(Array.from(uniqueIds));
    }
  };

  const toggleSubTopicSelection = (subTopicId: string) => {
    const prevSelected = selectedTopicIds.includes(subTopicId);
    if (prevSelected) {
      setSelectedTopicIds(prev => prev.filter(id => id !== subTopicId));
      // Also un-exclude anything inside this item
      setExcludedItemIds(prev => {
        const next = { ...prev };
        delete next[subTopicId];
        return next;
      });
    } else {
      setSelectedTopicIds(prev => [...prev, subTopicId]);
    }
  };

  const toggleItemExclusion = (item: StarterItem, isParentIncluded: boolean, isCurrentlyExcluded: boolean) => {
    // If it's a deep item, we flip it and all its children.
    const allIds = getAllChildIds(item);
    
    setExcludedItemIds(prev => {
      const next = { ...prev };
      allIds.forEach(id => {
        if (isCurrentlyExcluded) {
          // It was excluded, make it included (delete from excluded)
          delete next[id];
        } else {
          // Make it excluded
          next[id] = true;
        }
      });
      return next;
    });
  };

  const getIncludedContentCount = (item: StarterItem): { included: number, total: number } => {
    let included = 0;
    let total = 0;
    const isExcluded = excludedItemIds[item.id];
    
    if (item.type !== "folder") {
      total += 1;
      if (!isExcluded) included += 1;
    } else if (item.items) {
      // It's a folder. Even if the folder itself is excluded, we can still count its contents so the UI says 0/X
      item.items.forEach(child => {
        const childCounts = getIncludedContentCount(child);
        total += childCounts.total;
        included += childCounts.included;
      });
    }
    return { included, total };
  };

  // Recursively search and append item to a specific parent folder ID
  const insertItemRecursively = (items: StarterItem[], targetParentId: string, newItem: StarterItem): StarterItem[] => {
    return items.map(item => {
      if (item.id === targetParentId) {
        return {
          ...item,
          items: [...(item.items || []), newItem]
        };
      }
      if (item.items) {
        return {
          ...item,
          items: insertItemRecursively(item.items, targetParentId, newItem)
        };
      }
      return item;
    });
  };

  const handleAddInlineItem = (mainTopicId: string, targetId: string) => {
    if (inlineItemType !== "folder" && (!inlineItemTitle.trim() || !inlineItemUrl.trim())) return;
    if (inlineItemType === "folder" && !inlineItemTitle.trim()) return;
    
    const newItem: StarterItem = {
      id: `custom_item_${Date.now()}`,
      type: inlineItemType,
      title: inlineItemTitle.trim(),
      url: inlineItemType !== "folder" ? inlineItemUrl.trim() : undefined,
      items: inlineItemType === "folder" ? [] : undefined
    };

    setTopicOptions(prev => prev.map(mt => {
      if (mt.id !== mainTopicId) return mt;
      if (targetId === mainTopicId) {
        return {
          ...mt,
          subTopics: [...mt.subTopics, newItem]
        };
      }
      return {
        ...mt,
        subTopics: insertItemRecursively(mt.subTopics, targetId, newItem)
      };
    }));
    
    setInlineItemTitle("");
    setInlineItemUrl("");
    setInlineItemType("youtube");
    setAddInlineItemId(null);
  };

  const toggleTopicExpanded = (id: string) => setExpandedTopics(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleItemExpanded = (id: string) => setExpandedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const calculatePublishDate = (index: number, targetDay?: number): Date => {
    const startDate = publishStartDate ? new Date(publishStartDate) : new Date();
    const date = new Date(startDate);

    if (publishFreqMode === "interval") {
      date.setDate(date.getDate() + index * publishIntervalDays);
      return date;
    } else {
      const selectedDays = publishDaysOfWeek.length > 0 ? publishDaysOfWeek : [0];
      if (targetDay !== undefined) {
         let daysToAdd = (targetDay - date.getDay() + 7) % 7;
         date.setDate(date.getDate() + daysToAdd + index * 7);
         return date;
      }
      
      let validDaysHit = 0;
      let currentCheckDate = new Date(startDate);
      
      if (selectedDays.includes(currentCheckDate.getDay())) {
         if (index === 0) return currentCheckDate;
         validDaysHit++;
      }
      
      while (validDaysHit <= index) {
        currentCheckDate.setDate(currentCheckDate.getDate() + 1);
        if (selectedDays.includes(currentCheckDate.getDay())) {
          if (validDaysHit === index) return currentCheckDate;
          validDaysHit++;
        }
      }
      return currentCheckDate;
    }
  };

  useEffect(() => {
    if (!courseId) return;

    const initStep = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders();

        const courseResponse = await fetch(`/api/teacher/courses/${courseId}`, { headers });
        if (courseResponse.ok) {
          const courseData = await courseResponse.json();
          if (courseData.startDate) {
            setPublishStartDate(courseData.startDate.split('T')[0]);
          }
        }

        const topicsResponse = await fetch("/api/teacher/starter-catalog?verbose=1", { headers });
        const allTopics: StarterMainTopic[] = [];
        const seenIds = new Set<string>();
        
        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          const topics = Array.isArray(topicData.topics) ? topicData.topics : [];
          topics.forEach((t: any) => {
            if (!seenIds.has(t.id)) {
              // Convert StarterSubTopic to StarterItem model for starters
              const mappedSubTopics: StarterItem[] = (t.subTopics || []).map((st: any) => ({
                id: st.id,
                type: "folder",
                title: st.title,
                items: (st.videos || []).map((v: any, vIdx: number) => ({
                  id: `${st.id}_video_${vIdx}`,
                  type: "youtube",
                  title: v.title,
                  url: v.url
                }))
              }));

              allTopics.push({ ...t, subTopics: mappedSubTopics, source: "starter" });
              seenIds.add(t.id);
            }
          });
        }

        const videoResponse = await fetch("/api/teacher/video-library", { headers });
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          const libraryTopics = buildHierarchyFromLibraryNodes(nodes);
          libraryTopics.forEach(lt => {
            if (!seenIds.has(lt.id)) {
              allTopics.push(lt);
              seenIds.add(lt.id);
            }
          });
        }

        setTopicOptions(allTopics);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    initStep();
  }, [courseId]);

  const handleAddVideoToCustomTopic = () => {
    if (!newVideoTitle.trim() || !newVideoUrl.trim()) return;
    setNewTopicItems(prev => [...prev, {
      id: `custom_vid_${Date.now()}`,
      type: newVideoType,
      title: newVideoTitle,
      url: newVideoUrl,
    }]);
    setNewVideoTitle("");
    setNewVideoUrl("");
  };

  const handleCreateCustomTopic = () => {
    if (!newTopicTitle.trim()) return;
    
    const customTopic: StarterMainTopic = {
      id: `custom_${Date.now()}`,
      title: newTopicTitle,
      subTopics: [
        {
          id: `custom_sub_${Date.now()}`,
          title: newTopicTitle,
          type: "folder",
          items: newTopicItems,
        }
      ],
      source: "custom",
    };
    
    setTopicOptions(prev => [...prev, customTopic]);
    setNewTopicTitle("");
    setNewTopicItems([]);
    setShowCreateTopic(false);
  };

  const handleResetCustomTopic = () => {
    setShowCreateTopic(false);
    setNewTopicTitle("");
    setNewTopicItems([]);
    setNewVideoTitle("");
    setNewVideoUrl("");
  };

  const handleSaveAndContinue = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();

      // Clean payload: Remove excluded items deeply from the hierarchy before saving?
      // Since API is just accepting mainTopicIds for now based on your old logic, 
      // actual nested exclusion will require API update later. The UI filters it perfectly.
      if (selectedTopicIds.length > 0) {
        const mainTopicIds = topicOptions
          .filter(topic => selectedTopicIds.includes(topic.id) && topic.source === "starter")
          .map(t => t.id);

        if (mainTopicIds.length > 0) {
          const topicImportResponse = await fetch(`/api/teacher/courses/${courseId}/import-topics`, {
            method: "POST",
            headers,
            body: JSON.stringify({ mainTopicIds }),
          });

          if (!topicImportResponse.ok) {
            const topicError = await topicImportResponse.json();
            throw new Error(topicError.error || "Failed to import selected modules.");
          }
        }
      }

      router.push(`/teacher/dashboard/courses/create/review?courseId=${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save module and media options");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading options...</div>;
  }

  // Recursive render function for deep nesting
  const renderItemRecursively = (
    item: StarterItem, 
    mainTopicId: string, 
    level: number, 
    isParentIncluded: boolean,
    inheritedDate: string
  ) => {
    const isExcluded = excludedItemIds[item.id] || false;
    const isIncluded = isParentIncluded && !isExcluded;
    const isExpanded = expandedItems.includes(item.id);
    const hasItems = item.items && item.items.length > 0;
    
    // An overriding date ONLY gets displayed if manually set, otherwise display inheritedDate
    const overrideDate = dateOverrides[item.id];
    const displayDate = overrideDate || inheritedDate;

    return (
      <div key={item.id} style={{ marginLeft: `${level > 0 ? 16 : 0}px`, marginTop: "8px" }}>
        <div style={{
          padding: "10px 12px",
          background: "rgba(0, 0, 0, 0.1)",
          border: `1px solid var(--glass-border)`,
          borderRadius: "6px",
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          opacity: isExcluded ? 0.5 : 1,
          transition: "opacity 0.2s ease",
        }}>
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={() => toggleItemExclusion(item, isParentIncluded, isExcluded)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: "pointer", flexShrink: 0, marginTop: "3px" }}
          />
          
          {item.type === "folder" ? (
             <Folder size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }} />
          ) : (
             <Video size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }} />
          )}

          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => item.type === "folder" && toggleItemExpanded(item.id)}
              style={{
                background: "none", border: "none", padding: 0, margin: 0,
                color: "var(--foreground)", cursor: item.type === "folder" ? "pointer" : "default",
                display: "flex", alignItems: "center", gap: "4px",
                textDecoration: isExcluded ? "line-through" : "none",
                fontWeight: "500", textAlign: "left"
              }}
            >
              {item.type === "folder" && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              {!hasItems && item.type === "folder" && <span style={{ width: "14px" }}/>}
              {item.title}
            </button>
            
            {item.type === "folder" && (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {(() => {
                    const counts = getIncludedContentCount(item);
                    return `${counts.included}/${counts.total} content`;
                  })()}
                </span>
            )}
            
            {item.type !== "folder" && item.url && (
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
                {item.url.length > 30 ? `${item.url.substring(0, 30)}...` : item.url}
              </div>
            )}
          </div>
          
          {isIncluded && displayDate && (
             <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                <Calendar size={13} style={{ color: "var(--primary)" }} />
                <input
                  type="date"
                  value={displayDate}
                  onChange={(e) => setDateOverrides(prev => ({ ...prev, [item.id]: e.target.value }))}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    padding: "1px 2px", background: "transparent", border: "none", color: "var(--primary)",
                    fontSize: "0.8rem", fontWeight: "600", cursor: "pointer"
                  }}
                />
             </div>
          )}
        </div>

        {isExpanded && item.type === "folder" && (
          <div style={{ paddingLeft: "16px", borderLeft: "1px dashed var(--glass-border)", marginLeft: "6px" }}>
            {item.items && item.items.map((childItems) => renderItemRecursively(childItems, mainTopicId, level + 1, isIncluded, displayDate))}
            
            {/* Inline Add Button Inside Folder */}
            {isIncluded && (
              <div style={{ marginTop: "8px" }}>
                {addInlineItemId === item.id ? (
                  <div style={{
                    padding: "10px 12px", background: "rgba(var(--primary-rgb), 0.05)",
                    border: "1px dashed var(--primary)", borderRadius: "6px",
                    display: "flex", flexDirection: "column", gap: "8px",
                  }}>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                       <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Add:</label>
                       <select 
                         value={inlineItemType} 
                         onChange={(e) => setInlineItemType(e.target.value as any)}
                         style={{ 
                           padding: "4px", fontSize: "0.8rem", background: "var(--background)", 
                           color: "var(--foreground)", border: "1px solid var(--glass-border)", borderRadius: "4px" 
                         }}
                       >
                         <option value="youtube">YouTube Video</option>
                         <option value="self-hosted">Self-Hosted Video</option>
                         <option value="folder">Folder</option>
                       </select>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: inlineItemType === "folder" ? "1fr" : "1fr 1fr", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder={`${inlineItemType === 'folder' ? 'Folder' : 'Video'} title`}
                        value={inlineItemTitle}
                        onChange={(e) => setInlineItemTitle(e.target.value)}
                        style={{
                          padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                          background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                        }}
                      />
                      {inlineItemType !== "folder" && (
                        <input
                          type="text"
                          placeholder="URL"
                          value={inlineItemUrl}
                          onChange={(e) => setInlineItemUrl(e.target.value)}
                          style={{
                            padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                            background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                          }}
                        />
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setAddInlineItemId(null)}
                        style={{
                          padding: "4px 10px", background: "var(--glass-border)", color: "var(--foreground)",
                          border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem",
                        }}
                      >Cancel</button>
                      <button
                        type="button"
                        onClick={() => handleAddInlineItem(mainTopicId, item.id)}
                        disabled={inlineItemType !== "folder" ? (!inlineItemTitle.trim() || !inlineItemUrl.trim()) : !inlineItemTitle.trim()}
                        style={{
                          padding: "4px 10px", background: "var(--primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600"
                        }}
                      >Add</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddInlineItemId(item.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", background: "transparent",
                      border: "1px dashed var(--glass-border)", borderRadius: "6px", cursor: "pointer", color: "var(--text-muted)",
                      fontSize: "0.8rem", width: "100%", justifyContent: "center", transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    <Plus size={12} /> Add Content
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Modules & Media</h1>
          <p className={styles.subtitle}>Step 3 of 4: Select modules and set publish schedule</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "75%" }} />
          </div>
          <span className={styles.progressText}>75%</span>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.reviewContent}>
        {/* Publish Schedule Config */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Publish Schedule</h2>
          <p className={styles.helperText}>Set when your modules will be released. Start date is from your course settings in Step 1.</p>
          


          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>Release Mode</label>
              <select
                value={publishFreqMode}
                onChange={(e) => setPublishFreqMode(e.target.value as "interval" | "dayOfWeek")}
                style={{
                  padding: "10px 12px", border: "1px solid var(--glass-border)", borderRadius: "8px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem", width: "100%",
                }}
              >
                <option value="interval">Every X Days</option>
                <option value="dayOfWeek">Specific Days of Week</option>
              </select>
            </div>

            {publishFreqMode === "interval" && (
              <div>
                <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>Days Between Items</label>
                <select
                  value={publishIntervalDays}
                  onChange={(e) => setPublishIntervalDays(Number(e.target.value))}
                  style={{
                    padding: "10px 12px", border: "1px solid var(--glass-border)", borderRadius: "8px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.95rem", width: "100%",
                  }}
                >
                  {[1, 2, 3, 4, 5, 7, 10, 14].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {publishFreqMode === "dayOfWeek" && (
            <div>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "10px" }}>Release Days</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, dayIdx) => (
                  <label
                    key={dayIdx}
                    style={{
                      display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px",
                      border: `2px solid ${publishDaysOfWeek.includes(dayIdx) ? "var(--primary)" : "var(--glass-border)"}`,
                      borderRadius: "8px", cursor: "pointer", background: publishDaysOfWeek.includes(dayIdx) ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                      fontSize: "0.9rem", fontWeight: "600",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={publishDaysOfWeek.includes(dayIdx)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPublishDaysOfWeek(prev => [...prev, dayIdx].sort((a, b) => a - b));
                        } else {
                          setPublishDaysOfWeek(prev => prev.filter(d => d !== dayIdx));
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    {dayName}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Module Selection */}
        <div className={styles.contentCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h2 className={styles.contentTitle}>Your Modules & Media</h2>
              <p className={styles.helperText}>Select modules to include in your course. Select a main folder to include all content inside.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateTopic(!showCreateTopic)}
              style={{
                padding: "8px 14px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "600",
              }}
            >
              <Plus size={16} /> New Module
            </button>
          </div>

          {showCreateTopic && (
            <div style={{
              padding: "14px", background: "rgba(var(--primary-rgb), 0.05)", border: "1px solid var(--glass-border)",
              borderRadius: "8px", marginBottom: "16px", display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>Module Name</label>
                <input
                  type="text"
                  placeholder="e.g., Introduction to TypeScript"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 10px", border: "1px solid var(--glass-border)", borderRadius: "6px",
                    background: "var(--background)", color: "var(--foreground)", fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>Add Videos/Content</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {newTopicItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px", background: "var(--background)", border: "1px solid var(--glass-border)",
                        borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600" }}>{item.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{item.type}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewTopicItems(prev => prev.filter((_, i) => i !== idx))}
                        style={{ padding: "4px 8px", background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer", fontSize: "0.8rem" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr auto", gap: "8px", alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Title</label>
                      <input
                        type="text"
                        placeholder="Video title"
                        value={newVideoTitle}
                        onChange={(e) => setNewVideoTitle(e.target.value)}
                        style={{ padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Type</label>
                      <select
                        value={newVideoType}
                        onChange={(e) => setNewVideoType(e.target.value as "youtube" | "self-hosted")}
                        style={{ padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem" }}
                      >
                        <option value="youtube">YouTube</option>
                        <option value="self-hosted">Self-Hosted</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>URL</label>
                      <input
                        type="text"
                        placeholder="Video URL"
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        style={{ padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px", background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem" }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVideoToCustomTopic}
                      style={{ padding: "6px 10px", background: "var(--primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600" }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleResetCustomTopic}
                  style={{ padding: "8px 16px", background: "var(--glass-border)", color: "var(--foreground)", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem" }}
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleCreateCustomTopic}
                  disabled={!newTopicTitle.trim()}
                  style={{ padding: "8px 16px", background: newTopicTitle.trim() ? "var(--primary)" : "var(--text-muted)", color: "white", border: "none", borderRadius: "6px", cursor: newTopicTitle.trim() ? "pointer" : "not-allowed", fontSize: "0.9rem", fontWeight: "600" }}
                >Create Module</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {topicOptions.length === 0 && <p className={styles.emptyText}>No modules available.</p>}
            
            {topicOptions.map((mainTopic) => {
              const isExpanded = expandedTopics.includes(mainTopic.id);
              const allSubSelected = mainTopic.subTopics.every(st => selectedTopicIds.includes(st.id));
              const anySubSelected = mainTopic.subTopics.some(st => selectedTopicIds.includes(st.id));
              
              // Date running index relies on first-level topics
              const topicIndex = topicOptions.findIndex(t => t.id === mainTopic.id);
              let itemCountBeforeTopic = 0;
              topicOptions.slice(0, topicIndex).forEach(t => {
                if (selectedTopicIds.includes(t.id)) {
                  itemCountBeforeTopic += t.subTopics.filter(st => selectedTopicIds.includes(st.id)).length;
                }
              });

              return (
                <div key={mainTopic.id} style={{ border: "1px solid var(--glass-border)", borderRadius: "12px", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => toggleTopicExpanded(mainTopic.id)}
                    style={{
                      width: "100%", padding: "12px 14px", background: "transparent", border: "none", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "600", color: "var(--foreground)",
                    }}
                  >
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <input
                      type="checkbox"
                      checked={allSubSelected}
                      onChange={() => toggleTopicSelection(mainTopic.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: "pointer" }}
                    />
                    <Folder size={18} style={{ color: "var(--text-muted)" }} />
                    <span style={{ flex: 1, textAlign: "left" }}>{mainTopic.title}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {mainTopic.subTopics.length} top-level item{mainTopic.subTopics.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingLeft: "14px", paddingRight: "14px", paddingBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {mainTopic.subTopics.map((subTopic, subIdx) => {
                        const isSelected = selectedTopicIds.includes(subTopic.id);
                        let calculatedDate = "";
                        
                        if (isSelected) {
                          const itemIndex = itemCountBeforeTopic + mainTopic.subTopics.slice(0, subIdx).filter(st => selectedTopicIds.includes(st.id)).length;
                          calculatedDate = calculatePublishDate(itemIndex).toISOString().split('T')[0];
                        }
                        
                        // Pass inheritedDate inside recursive renderer
                        return (
                          <div key={subTopic.id} style={{
                            border: "1px solid var(--glass-border)", borderRadius: "8px", overflow: "hidden", padding: "8px 12px", paddingBottom: "12px",
                            background: isSelected ? "rgba(var(--primary-rgb), 0.05)" : "transparent",
                          }}>
                            {/* Render top-level item as checkbox, same pattern as deep items but handles 'subTopic' selection via selectedTopicIds instead of excludedItemIds */}
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSubTopicSelection(subTopic.id)}
                                style={{ cursor: "pointer", flexShrink: 0, marginTop: "3px" }}
                              />
                              {subTopic.type === "folder" ? (
                                <Folder size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              ) : (
                                <Video size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              )}
                              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontWeight: "600" }}>{subTopic.title}</span>
                                {subTopic.type === "folder" && (
                                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                    {(() => {
                                      const counts = getIncludedContentCount(subTopic);
                                      return `${counts.included}/${counts.total} content`;
                                    })()}
                                  </span>
                                )} 
                              </div>
                              {isSelected && calculatedDate && (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                                  <Calendar size={14} style={{ color: "var(--primary)" }} />
                                  <input
                                    type="date"
                                    value={dateOverrides[subTopic.id] || calculatedDate}
                                    onChange={(e) => setDateOverrides(prev => ({ ...prev, [subTopic.id]: e.target.value }))}
                                    style={{
                                      padding: "2px 4px", background: "var(--background)", border: "1px solid var(--glass-border)", borderRadius: "4px", color: "var(--primary)",
                                      fontSize: "0.85rem", fontWeight: "600", cursor: "pointer"
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Render children recursively */}
                            {subTopic.type === "folder" && isSelected && (
                              <div style={{ marginTop: "4px" }}>
                                {subTopic.items?.map(child => renderItemRecursively(child, mainTopic.id, 0, isSelected, dateOverrides[subTopic.id] || calculatedDate))}
                                
                                {/* Inline Add inside TOP LEVEL sub-topic */}
                                <div style={{ marginTop: "12px", marginLeft: "28px" }}>
                                  {addInlineItemId === subTopic.id ? (
                                    <div style={{
                                      padding: "10px 12px", background: "rgba(var(--primary-rgb), 0.05)",
                                      border: "1px dashed var(--primary)", borderRadius: "6px",
                                      display: "flex", flexDirection: "column", gap: "8px",
                                    }}>
                                      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                                         <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Add:</label>
                                         <select 
                                           value={inlineItemType} 
                                           onChange={(e) => setInlineItemType(e.target.value as any)}
                                           style={{ 
                                             padding: "4px", fontSize: "0.8rem", background: "var(--background)", 
                                             color: "var(--foreground)", border: "1px solid var(--glass-border)", borderRadius: "4px" 
                                           }}
                                         >
                                           <option value="youtube">YouTube Video</option>
                                           <option value="self-hosted">Self-Hosted Video</option>
                                           <option value="folder">Folder</option>
                                         </select>
                                      </div>
                                      
                                      <div style={{ display: "grid", gridTemplateColumns: inlineItemType === "folder" ? "1fr" : "1fr 1fr", gap: "8px" }}>
                                        <input
                                          type="text"
                                          placeholder={`${inlineItemType === 'folder' ? 'Folder' : 'Video'} title`}
                                          value={inlineItemTitle}
                                          onChange={(e) => setInlineItemTitle(e.target.value)}
                                          style={{
                                            padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                                            background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                                          }}
                                        />
                                        {inlineItemType !== "folder" && (
                                          <input
                                            type="text"
                                            placeholder="URL"
                                            value={inlineItemUrl}
                                            onChange={(e) => setInlineItemUrl(e.target.value)}
                                            style={{
                                              padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                                              background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                                            }}
                                          />
                                        )}
                                      </div>
                                      
                                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                        <button
                                          type="button"
                                          onClick={() => setAddInlineItemId(null)}
                                          style={{
                                            padding: "4px 10px", background: "var(--glass-border)", color: "var(--foreground)",
                                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem",
                                          }}
                                        >Cancel</button>
                                        <button
                                          type="button"
                                          onClick={() => handleAddInlineItem(mainTopic.id, subTopic.id)}
                                          disabled={inlineItemType !== "folder" ? (!inlineItemTitle.trim() || !inlineItemUrl.trim()) : !inlineItemTitle.trim()}
                                          style={{
                                            padding: "4px 10px", background: "var(--primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600"
                                          }}
                                        >Add</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setAddInlineItemId(subTopic.id)}
                                      style={{
                                        display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", background: "transparent",
                                        border: "1px dashed var(--glass-border)", borderRadius: "6px", cursor: "pointer", color: "var(--text-muted)",
                                        fontSize: "0.8rem", width: "100%", justifyContent: "center", transition: "all 0.2s ease",
                                      }}
                                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                                    >
                                      <Plus size={12} /> Add Content
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}

                      {/* ADD ROOT CONTENT BLOCK */}
                      <div style={{ marginTop: "12px", marginLeft: "14px", marginRight: "14px" }}>
                        {addInlineItemId === mainTopic.id ? (
                          <div style={{
                            padding: "10px 12px", background: "rgba(var(--primary-rgb), 0.05)",
                            border: "1px dashed var(--primary)", borderRadius: "6px",
                            display: "flex", flexDirection: "column", gap: "8px",
                          }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                               <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Add:</label>
                               <select 
                                 value={inlineItemType} 
                                 onChange={(e) => setInlineItemType(e.target.value as any)}
                                 style={{ 
                                   padding: "4px", fontSize: "0.8rem", background: "var(--background)", 
                                   color: "var(--foreground)", border: "1px solid var(--glass-border)", borderRadius: "4px" 
                                 }}
                               >
                                 <option value="youtube">YouTube Video</option>
                                 <option value="self-hosted">Self-Hosted Video</option>
                                 <option value="folder">Folder</option>
                               </select>
                            </div>
                            
                            <div style={{ display: "grid", gridTemplateColumns: inlineItemType === "folder" ? "1fr" : "1fr 1fr", gap: "8px" }}>
                              <input
                                type="text"
                                placeholder={`${inlineItemType === 'folder' ? 'Folder' : 'Video'} title`}
                                value={inlineItemTitle}
                                onChange={(e) => setInlineItemTitle(e.target.value)}
                                style={{
                                  padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                                  background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                                }}
                              />
                              {inlineItemType !== "folder" && (
                                <input
                                  type="text"
                                  placeholder="URL"
                                  value={inlineItemUrl}
                                  onChange={(e) => setInlineItemUrl(e.target.value)}
                                  style={{
                                    padding: "6px 8px", border: "1px solid var(--glass-border)", borderRadius: "4px",
                                    background: "var(--background)", color: "var(--foreground)", fontSize: "0.8rem",
                                  }}
                                />
                              )}
                            </div>
                            
                            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => setAddInlineItemId(null)}
                                style={{
                                  padding: "4px 10px", background: "var(--glass-border)", color: "var(--foreground)",
                                  border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem",
                                }}
                              >Cancel</button>
                              <button
                                type="button"
                                onClick={() => handleAddInlineItem(mainTopic.id, mainTopic.id)}
                                disabled={inlineItemType !== "folder" ? (!inlineItemTitle.trim() || !inlineItemUrl.trim()) : !inlineItemTitle.trim()}
                                style={{
                                  padding: "4px 10px", background: "var(--primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "600"
                                }}
                              >Add</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddInlineItemId(mainTopic.id)}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", background: "transparent",
                              border: "1px dashed var(--glass-border)", borderRadius: "6px", cursor: "pointer", color: "var(--text-muted)",
                              fontSize: "0.8rem", width: "100%", justifyContent: "center", transition: "all 0.2s ease",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                          >
                            <Plus size={12} /> Add Content
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard")}
            className={styles.cancelBtn}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/create/content?courseId=${courseId}`)
            }
            className={styles.backBtn}
            disabled={saving}
          >
            <ArrowLeft size={20} /> Back
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            className={styles.publishBtn}
            disabled={saving || selectedTopicIds.length === 0}
          >
            {saving ? "Saving..." : <><ArrowRight size={20} /> Next: Review</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateCourseStep3() {
  return (
    <Suspense fallback={<div style={{ padding: "20px" }}>Loading...</div>}>
      <CreateCourseStep3Content />
    </Suspense>
  );
}
