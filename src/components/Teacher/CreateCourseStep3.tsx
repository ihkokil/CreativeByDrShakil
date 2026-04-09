"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Calendar, Plus, Folder, FileText } from "lucide-react";
import styles from "./CreateCourseStep3.module.css";

interface StarterVideo {
  title: string;
  url: string;
}

interface StarterSubTopic {
  id: string;
  title: string;
  videos: StarterVideo[];
  forceFolder?: boolean;
}

interface StarterMainTopic {
  id: string;
  title: string;
  subTopics: StarterSubTopic[];
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
  
  // Publish frequency controls
  const [publishFreqMode, setPublishFreqMode] = useState<"interval" | "dayOfWeek">("interval");
  const [publishIntervalDays, setPublishIntervalDays] = useState(7);
  const [publishDaysOfWeek, setPublishDaysOfWeek] = useState<number[]>([0]); // 0 = Sunday; now can select multiple
  const [publishStartDate, setPublishStartDate] = useState("");
  
  // Manual date overrides for first-level items
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  
  // Custom topic creation
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Convert flat video library nodes into hierarchical structure
  const buildHierarchyFromLibraryNodes = (nodes: LibraryNode[]): StarterMainTopic[] => {
    const topLevelFolders = nodes.filter(n => !n.parentId && n.type === "folder");
    
    return topLevelFolders.map(folder => {
      const childNodes = nodes.filter(n => n.parentId === folder.id);
      const subFolders = childNodes.filter(n => n.type === "folder");
      
      const subTopics: StarterSubTopic[] = subFolders.map(subFolder => {
        const videos: StarterVideo[] = nodes
          .filter(n => n.parentId === subFolder.id && n.type !== "folder")
          .map(v => ({
            title: v.title,
            url: v.url || "",
          }));
        
        return {
          id: subFolder.id,
          title: subFolder.title,
          videos,
          forceFolder: true,
        };
      });
      
      // Also include direct child videos in the first subtopic
      const directVideos: StarterVideo[] = childNodes
        .filter(n => n.type !== "folder")
        .map(v => ({
          title: v.title,
          url: v.url || "",
        }));
      
      if (directVideos.length > 0 && subTopics.length === 0) {
        subTopics.push({
          id: `${folder.id}_root`,
          title: folder.title,
          videos: directVideos,
          forceFolder: true,
        });
      } else if (directVideos.length > 0) {
        subTopics[0].videos.unshift(...directVideos);
      }
      
      return {
        id: folder.id,
        title: folder.title,
        subTopics,
        source: "library",
      };
    });
  };

  // Toggle topic selection and auto-select/deselect subtopic IDs
  const toggleTopicSelection = (mainTopicId: string) => {
    const topic = topicOptions.find(t => t.id === mainTopicId);
    if (!topic) return;

    const subTopicIds = topic.subTopics.map(st => st.id);
    const allSelected = selectedTopicIds.includes(mainTopicId) && subTopicIds.every(id => selectedTopicIds.includes(id));

    if (allSelected) {
      // Deselect main topic and all subtopics
      setSelectedTopicIds(prev => prev.filter(id => id !== mainTopicId && !subTopicIds.includes(id)));
    } else {
      // Select main topic and all subtopics
      const uniqueIds = new Set([...selectedTopicIds, mainTopicId, ...subTopicIds]);
      setSelectedTopicIds(Array.from(uniqueIds));
    }
  };

  const toggleSubTopicSelection = (subTopicId: string) => {
    const prevSelected = selectedTopicIds.includes(subTopicId);
    if (prevSelected) {
      setSelectedTopicIds(prev => prev.filter(id => id !== subTopicId));
    } else {
      setSelectedTopicIds(prev => [...prev, subTopicId]);
    }
  };

  const toggleTopicExpanded = (mainTopicId: string) => {
    setExpandedTopics(prev =>
      prev.includes(mainTopicId)
        ? prev.filter(id => id !== mainTopicId)
        : [...prev, mainTopicId]
    );
  };

  // Calculate publish date for a first-level item based on frequency
  const calculatePublishDate = (index: number, targetDay?: number): Date => {
    const startDate = publishStartDate ? new Date(publishStartDate) : new Date();
    const date = new Date(startDate);

    if (publishFreqMode === "interval") {
      date.setDate(date.getDate() + index * publishIntervalDays);
    } else {
      // Day of week mode - use the first selected day or provided target day
      const dayToUse = targetDay !== undefined ? targetDay : publishDaysOfWeek[0] || 0;
      const currentDay = date.getDay();
      let daysToAdd = (dayToUse - currentDay + 7) % 7;
      if (daysToAdd === 0 && index > 0) daysToAdd = 7;
      date.setDate(date.getDate() + daysToAdd + (index - (index > 0 ? 1 : 0)) * 7);
    }

    return date;
  };

  // Format date for display
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Get all first-level items with their calculated dates
  const getFirstLevelItemsWithDates = () => {
    const items: Array<{ id: string; title: string; mainTopicTitle: string; calculatedDate: string }> = [];
    let itemIndex = 0;

    topicOptions.forEach(mainTopic => {
      if (!selectedTopicIds.includes(mainTopic.id)) return;

      mainTopic.subTopics.forEach(subTopic => {
        if (!selectedTopicIds.includes(subTopic.id)) return;

        const calculatedDate = calculatePublishDate(itemIndex).toISOString().split('T')[0];
        const overrideDate = dateOverrides[subTopic.id];

        items.push({
          id: subTopic.id,
          title: subTopic.title,
          mainTopicTitle: mainTopic.title,
          calculatedDate: overrideDate || calculatedDate,
        });

        itemIndex += 1;
      });
    });

    return items;
  };

  useEffect(() => {
    if (!courseId) return;

    const initStep = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders();

        // Fetch course to get start date
        const courseResponse = await fetch(`/api/teacher/courses/${courseId}`, { headers });
        if (courseResponse.ok) {
          const courseData = await courseResponse.json();
          if (courseData.startDate) {
            setPublishStartDate(courseData.startDate.split('T')[0]);
          }
        }

        // Fetch full catalog with verbose=1
        const topicsResponse = await fetch("/api/teacher/starter-catalog?verbose=1", { headers });
        const starterTopics: StarterMainTopic[] = [];
        
        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          const topics = Array.isArray(topicData.topics) ? topicData.topics : [];
          starterTopics.push(...topics.map((t: any) => ({ ...t, source: "starter" })));
        }

        // Fetch video library and build hierarchy
        const videoResponse = await fetch("/api/teacher/video-library", { headers });
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          const libraryTopics = buildHierarchyFromLibraryNodes(nodes);
          starterTopics.push(...libraryTopics);
        }

        setTopicOptions(starterTopics);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    initStep();
  }, [courseId]);

  const handleCreateCustomTopic = () => {
    if (!newTopicTitle.trim()) return;
    
    const customTopic: StarterMainTopic = {
      id: `custom_${Date.now()}`,
      title: newTopicTitle,
      subTopics: [
        {
          id: `custom_sub_${Date.now()}`,
          title: newTopicTitle,
          videos: [],
          forceFolder: true,
        }
      ],
      source: "custom",
    };
    
    setTopicOptions(prev => [...prev, customTopic]);
    setNewTopicTitle("");
    setShowCreateTopic(false);
  };

  const handleSaveAndContinue = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();

      // Import selected topics
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

      // Redirect to step 4 (review + publish)
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

  const firstLevelItems = getFirstLevelItemsWithDates();

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
          <p className={styles.helperText}>Set when your modules will be released. Start date is set to your course start date.</p>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>Start Date</label>
            <input
              type="date"
              value={publishStartDate}
              onChange={(e) => setPublishStartDate(e.target.value)}
              style={{
                padding: "10px 12px",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: "0.95rem",
                width: "100%",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>Release Mode</label>
              <select
                value={publishFreqMode}
                onChange={(e) => setPublishFreqMode(e.target.value as "interval" | "dayOfWeek")}
                style={{
                  padding: "10px 12px",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "0.95rem",
                  width: "100%",
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
                    padding: "10px 12px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.95rem",
                    width: "100%",
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
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 12px",
                      border: `2px solid ${publishDaysOfWeek.includes(dayIdx) ? "var(--primary)" : "var(--glass-border)"}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: publishDaysOfWeek.includes(dayIdx) ? "rgba(var(--primary-rgb), 0.1)" : "transparent",
                      fontSize: "0.9rem",
                      fontWeight: "600",
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
                padding: "8px 14px",
                background: "var(--primary)",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "0.9rem",
                fontWeight: "600",
              }}
            >
              <Plus size={16} /> New Module
            </button>
          </div>

          {showCreateTopic && (
            <div style={{
              padding: "12px 14px",
              background: "rgba(var(--primary-rgb), 0.05)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              marginBottom: "16px",
              display: "flex",
              gap: "8px",
            }}>
              <input
                type="text"
                placeholder="Module name..."
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleCreateCustomTopic();
                }}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "6px",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                onClick={handleCreateCustomTopic}
                style={{
                  padding: "8px 16px",
                  background: "var(--primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  fontWeight: "600",
                }}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateTopic(false);
                  setNewTopicTitle("");
                }}
                style={{
                  padding: "8px 16px",
                  background: "var(--glass-border)",
                  color: "var(--foreground)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {topicOptions.length === 0 && <p className={styles.emptyText}>No modules available.</p>}
            
            {topicOptions.map((mainTopic) => {
              const isExpanded = expandedTopics.includes(mainTopic.id);
              const allSubSelected = mainTopic.subTopics.every(st => selectedTopicIds.includes(st.id));
              const anySubSelected = mainTopic.subTopics.some(st => selectedTopicIds.includes(st.id));
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
                      width: "100%",
                      padding: "12px 14px",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      fontWeight: "600",
                      color: "var(--foreground)",
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
                    <span style={{ flex: 1 }}>{mainTopic.title}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {mainTopic.subTopics.length} item{mainTopic.subTopics.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingLeft: "28px", paddingRight: "14px", paddingBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {mainTopic.subTopics.map((subTopic, subIdx) => {
                        const isSelected = selectedTopicIds.includes(subTopic.id);
                        let calculatedDate = "";
                        
                        if (isSelected) {
                          const itemIndex = itemCountBeforeTopic + mainTopic.subTopics.slice(0, subIdx).filter(st => selectedTopicIds.includes(st.id)).length;
                          calculatedDate = calculatePublishDate(itemIndex).toISOString().split('T')[0];
                        }
                        
                        const overrideDate = dateOverrides[subTopic.id];
                        const displayDate = overrideDate || calculatedDate;

                        return (
                          <div
                            key={subTopic.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "10px 12px",
                              border: "1px solid var(--glass-border)",
                              borderRadius: "8px",
                              background: isSelected ? "rgba(var(--primary-rgb), 0.05)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSubTopicSelection(subTopic.id)}
                              style={{ cursor: "pointer" }}
                            />
                            <FileText size={16} style={{ color: "var(--text-muted)" }} />
                            <span style={{ flex: 1, fontSize: "0.9rem" }}>{subTopic.title}</span>
                            {isSelected && displayDate && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <Calendar size={14} style={{ color: "var(--primary)" }} />
                                <input
                                  type="date"
                                  value={overrideDate || displayDate}
                                  onChange={(e) =>
                                    setDateOverrides(prev => ({
                                      ...prev,
                                      [subTopic.id]: e.target.value,
                                    }))
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    padding: "4px 6px",
                                    border: "1px solid var(--glass-border)",
                                    borderRadius: "4px",
                                    background: "var(--background)",
                                    color: "var(--foreground)",
                                    fontSize: "0.8rem",
                                    minWidth: "110px",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
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
