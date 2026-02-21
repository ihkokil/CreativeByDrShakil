"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Calendar, Plus, Folder, FileText, Video } from "lucide-react";
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
  const [expandedSubTopics, setExpandedSubTopics] = useState<string[]>([]);
  
  // Publish frequency controls
  const [publishFreqMode, setPublishFreqMode] = useState<"interval" | "dayOfWeek">("interval");
  const [publishIntervalDays, setPublishIntervalDays] = useState(7);
  const [publishDaysOfWeek, setPublishDaysOfWeek] = useState<number[]>([0]); // 0 = Sunday; now can select multiple
  const [publishStartDate, setPublishStartDate] = useState("");
  
  // Manual date overrides for first-level items
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});
  
  // Per-video exclusion: keyed by subTopic.id, value is array of excluded video indices
  const [excludedVideoIndices, setExcludedVideoIndices] = useState<Record<string, number[]>>({});
  
  // Inline add-video form: tracks which subTopic currently has the form open
  const [addVideoSubTopicId, setAddVideoSubTopicId] = useState<string | null>(null);
  const [inlineVideoTitle, setInlineVideoTitle] = useState("");
  const [inlineVideoUrl, setInlineVideoUrl] = useState("");
  
  // Custom topic creation
  const [showCreateTopic, setShowCreateTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicVideos, setNewTopicVideos] = useState<{ title: string; url: string; type: "youtube" | "self-hosted" }[]>([]);
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

  // Recursively collect all videos from a folder and its subfolders
  const collectVideosRecursively = (nodes: LibraryNode[], parentId: string): StarterVideo[] => {
    const videos: StarterVideo[] = [];
    const children = nodes.filter(n => n.parentId === parentId);
    
    children.forEach(child => {
      if (child.type !== "folder") {
        videos.push({
          title: child.title,
          url: child.url || "",
        });
      } else {
        // Recursively get videos from subfolders
        videos.push(...collectVideosRecursively(nodes, child.id));
      }
    });
    
    return videos;
  };

  // Recursively build subtopics from nested folder structure
  const buildSubTopicsRecursively = (nodes: LibraryNode[], parentId: string): StarterSubTopic[] => {
    const children = nodes.filter(n => n.parentId === parentId && n.type === "folder");
    const subTopics: StarterSubTopic[] = [];
    
    children.forEach(folder => {
      const allVideos = collectVideosRecursively(nodes, folder.id);
      subTopics.push({
        id: folder.id,
        title: folder.title,
        videos: allVideos,
        forceFolder: true,
      });
    });
    
    return subTopics;
  };

  // Convert flat video library nodes into hierarchical structure
  const buildHierarchyFromLibraryNodes = (nodes: LibraryNode[]): StarterMainTopic[] => {
    const topLevelFolders = nodes.filter(n => !n.parentId && n.type === "folder");
    
    return topLevelFolders.map(folder => {
      const subTopics = buildSubTopicsRecursively(nodes, folder.id);
      
      // Also include direct child videos (not in any subfolder)
      const directChildren = nodes.filter(n => n.parentId === folder.id && n.type !== "folder");
      
      if (directChildren.length > 0) {
        // Each direct child video becomes its own individually-selectable sub-topic
        const directVideoSubTopics: StarterSubTopic[] = directChildren.map(child => ({
          id: child.id,
          title: child.title,
          videos: [{ title: child.title, url: child.url || "" }],
        }));
        subTopics.push(...directVideoSubTopics);
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
      // Also clear any per-video exclusions for this sub-topic
      setExcludedVideoIndices(prev => {
        const next = { ...prev };
        delete next[subTopicId];
        return next;
      });
    } else {
      setSelectedTopicIds(prev => [...prev, subTopicId]);
    }
  };

  const toggleVideoExclusion = (subTopicId: string, videoIndex: number) => {
    setExcludedVideoIndices(prev => {
      const current = prev[subTopicId] || [];
      const isExcluded = current.includes(videoIndex);
      return {
        ...prev,
        [subTopicId]: isExcluded
          ? current.filter(i => i !== videoIndex)
          : [...current, videoIndex],
      };
    });
  };

  const getIncludedVideoCount = (subTopicId: string, totalVideos: number): number => {
    const excluded = excludedVideoIndices[subTopicId] || [];
    return totalVideos - excluded.length;
  };

  const handleAddVideoToSubTopic = (mainTopicId: string, subTopicId: string) => {
    if (!inlineVideoTitle.trim() || !inlineVideoUrl.trim()) return;
    
    setTopicOptions(prev => prev.map(mt => {
      if (mt.id !== mainTopicId) return mt;
      return {
        ...mt,
        subTopics: mt.subTopics.map(st => {
          if (st.id !== subTopicId) return st;
          return {
            ...st,
            videos: [...st.videos, { title: inlineVideoTitle.trim(), url: inlineVideoUrl.trim() }],
          };
        }),
      };
    }));
    
    setInlineVideoTitle("");
    setInlineVideoUrl("");
    setAddVideoSubTopicId(null);
  };

  const toggleTopicExpanded = (mainTopicId: string) => {
    setExpandedTopics(prev =>
      prev.includes(mainTopicId)
        ? prev.filter(id => id !== mainTopicId)
        : [...prev, mainTopicId]
    );
  };

  const toggleSubTopicExpanded = (subTopicId: string) => {
    setExpandedSubTopics(prev =>
      prev.includes(subTopicId)
        ? prev.filter(id => id !== subTopicId)
        : [...prev, subTopicId]
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

  // Calculate global item index for a specific sub-topic video
  const getVideoPublishDate = (mainTopicId: string, subTopicId: string, videoIndex: number): string => {
    let globalIndex = 0;

    for (const mainTopic of topicOptions) {
      if (mainTopic.id === mainTopicId) {
        // Found the main topic, now calculate index within it
        for (const subTopic of mainTopic.subTopics) {
          if (subTopic.id === subTopicId) {
            // Found the sub-topic, add video index
            globalIndex += videoIndex;
            break;
          }
          // Count all videos in this sub-topic
          if (selectedTopicIds.includes(subTopic.id)) {
            globalIndex += subTopic.videos.length;
          }
        }
        break;
      }
      // Count all items before this main topic
      if (selectedTopicIds.includes(mainTopic.id)) {
        mainTopic.subTopics.forEach(st => {
          if (selectedTopicIds.includes(st.id)) {
            globalIndex += st.videos.length;
          }
        });
      }
    }

    const calculatedDate = calculatePublishDate(globalIndex).toISOString().split('T')[0];
    return calculatedDate;
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
        const allTopics: StarterMainTopic[] = [];
        const seenIds = new Set<string>();
        
        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          const topics = Array.isArray(topicData.topics) ? topicData.topics : [];
          topics.forEach((t: any) => {
            if (!seenIds.has(t.id)) {
              allTopics.push({ ...t, source: "starter" });
              seenIds.add(t.id);
            }
          });
        }

        // Fetch video library and build hierarchy
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
    setNewTopicVideos(prev => [...prev, {
      title: newVideoTitle,
      url: newVideoUrl,
      type: newVideoType,
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
          videos: newTopicVideos,
          forceFolder: true,
        }
      ],
      source: "custom",
    };
    
    setTopicOptions(prev => [...prev, customTopic]);
    setNewTopicTitle("");
    setNewTopicVideos([]);
    setShowCreateTopic(false);
  };

  const handleResetCustomTopic = () => {
    setShowCreateTopic(false);
    setNewTopicTitle("");
    setNewTopicVideos([]);
    setNewVideoTitle("");
    setNewVideoUrl("");
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
          <p className={styles.helperText}>Set when your modules will be released. Start date is from your course settings in Step 1.</p>
          
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: "600", display: "block", marginBottom: "8px" }}>Start Date</label>
            <div
              style={{
                padding: "10px 12px",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                background: "var(--glass-bg, rgba(255,255,255,0.05))",
                color: "var(--foreground)",
                fontSize: "0.95rem",
                width: "100%",
              }}
            >
              {publishStartDate ? new Date(publishStartDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Not set"}
            </div>
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
              padding: "14px",
              background: "rgba(var(--primary-rgb), 0.05)",
              border: "1px solid var(--glass-border)",
              borderRadius: "8px",
              marginBottom: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>Module Name</label>
                <input
                  type="text"
                  placeholder="e.g., Introduction to TypeScript"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "6px",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "600", display: "block", marginBottom: "6px" }}>Add Videos/Content</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {newTopicVideos.map((video, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "8px 10px",
                        background: "var(--background)",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "6px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600" }}>{video.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{video.type}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNewTopicVideos(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          padding: "4px 8px",
                          background: "transparent",
                          color: "var(--text-muted)",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
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
                        style={{
                          padding: "6px 8px",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "4px",
                          background: "var(--background)",
                          color: "var(--foreground)",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "0.8rem", fontWeight: "600" }}>Type</label>
                      <select
                        value={newVideoType}
                        onChange={(e) => setNewVideoType(e.target.value as "youtube" | "self-hosted")}
                        style={{
                          padding: "6px 8px",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "4px",
                          background: "var(--background)",
                          color: "var(--foreground)",
                          fontSize: "0.8rem",
                        }}
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
                        style={{
                          padding: "6px 8px",
                          border: "1px solid var(--glass-border)",
                          borderRadius: "4px",
                          background: "var(--background)",
                          color: "var(--foreground)",
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddVideoToCustomTopic}
                      style={{
                        padding: "6px 10px",
                        background: "var(--primary)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: "600",
                      }}
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
                <button
                  type="button"
                  onClick={handleCreateCustomTopic}
                  disabled={!newTopicTitle.trim()}
                  style={{
                    padding: "8px 16px",
                    background: newTopicTitle.trim() ? "var(--primary)" : "var(--text-muted)",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: newTopicTitle.trim() ? "pointer" : "not-allowed",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                  }}
                >
                  Create Module
                </button>
              </div>
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
                        const isSubExpanded = expandedSubTopics.includes(subTopic.id);
                        const isSelected = selectedTopicIds.includes(subTopic.id);
                        let calculatedDate = "";
                        
                        if (isSelected) {
                          const itemIndex = itemCountBeforeTopic + mainTopic.subTopics.slice(0, subIdx).filter(st => selectedTopicIds.includes(st.id)).length;
                          calculatedDate = calculatePublishDate(itemIndex).toISOString().split('T')[0];
                        }
                        
                        const overrideDate = dateOverrides[subTopic.id];
                        const displayDate = overrideDate || calculatedDate;
                        const hasVideos = subTopic.videos && subTopic.videos.length > 0;

                        return (
                          <div
                            key={subTopic.id}
                            style={{
                              border: "1px solid var(--glass-border)",
                              borderRadius: "8px",
                              overflow: "hidden",
                              background: isSelected ? "rgba(var(--primary-rgb), 0.05)" : "transparent",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (hasVideos) toggleSubTopicExpanded(subTopic.id);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 12px",
                                background: "transparent",
                                border: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: hasVideos ? "pointer" : "default",
                                fontSize: "0.9rem",
                              }}
                            >
                              {hasVideos && (
                                isSubExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                              )}
                              {!hasVideos && <span style={{ width: "16px" }} />}
                              
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSubTopicSelection(subTopic.id)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ cursor: "pointer" }}
                              />
                              <FileText size={16} style={{ color: "var(--text-muted)" }} />
                              <span style={{ flex: 1 }}>{subTopic.title}</span>
                              {hasVideos && (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                  {getIncludedVideoCount(subTopic.id, subTopic.videos.length)}/{subTopic.videos.length} video{subTopic.videos.length !== 1 ? "s" : ""}
                                </span>
                              )}
                              {isSelected && displayDate && (
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
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
                                      padding: "2px 4px",
                                      border: "1px solid var(--glass-border)",
                                      borderRadius: "3px",
                                      background: "var(--background)",
                                      color: "var(--foreground)",
                                      fontSize: "0.75rem",
                                      minWidth: "95px",
                                    }}
                                  />
                                </div>
                              )}
                            </button>

                            {hasVideos && isSubExpanded && (
                              <div style={{ paddingLeft: "36px", paddingRight: "12px", paddingBottom: "10px", paddingTop: "4px", display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid var(--glass-border)" }}>
                                {subTopic.videos.map((video, vidIdx) => {
                                  const isVideoExcluded = (excludedVideoIndices[subTopic.id] || []).includes(vidIdx);
                                  const videoPublishDate = (isSelected && !isVideoExcluded) ? getVideoPublishDate(mainTopic.id, subTopic.id, vidIdx) : "";
                                  
                                  return (
                                    <div
                                      key={vidIdx}
                                      style={{
                                        padding: "10px 12px",
                                        background: isVideoExcluded ? "transparent" : "rgba(0, 0, 0, 0.1)",
                                        border: `1px solid ${isVideoExcluded ? "var(--glass-border)" : "var(--glass-border)"}`,
                                        borderRadius: "6px",
                                        fontSize: "0.85rem",
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: "10px",
                                        opacity: isVideoExcluded ? 0.5 : 1,
                                        transition: "opacity 0.2s ease",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected && !isVideoExcluded}
                                        onChange={() => toggleVideoExclusion(subTopic.id, vidIdx)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ cursor: "pointer", flexShrink: 0, marginTop: "3px" }}
                                      />
                                      <FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ wordBreak: "break-word", fontWeight: "500", marginBottom: "3px", textDecoration: isVideoExcluded ? "line-through" : "none" }}>{video.title}</div>
                                        {video.url && (
                                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
                                            {video.url.length > 50 ? `${video.url.substring(0, 50)}...` : video.url}
                                          </div>
                                        )}
                                      </div>
                                      {isSelected && !isVideoExcluded && videoPublishDate && (
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, whiteSpace: "nowrap" }}>
                                          <Calendar size={13} style={{ color: "var(--primary)" }} />
                                          <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--primary)" }}>
                                            {new Date(videoPublishDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Inline Add Video Button & Form */}
                                {isSelected && (
                                  <div style={{ marginTop: "4px" }}>
                                    {addVideoSubTopicId === subTopic.id ? (
                                      <div style={{
                                        padding: "10px 12px",
                                        background: "rgba(var(--primary-rgb), 0.05)",
                                        border: "1px dashed var(--primary)",
                                        borderRadius: "6px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px",
                                      }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                          <input
                                            type="text"
                                            placeholder="Video title"
                                            value={inlineVideoTitle}
                                            onChange={(e) => setInlineVideoTitle(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              padding: "6px 8px",
                                              border: "1px solid var(--glass-border)",
                                              borderRadius: "4px",
                                              background: "var(--background)",
                                              color: "var(--foreground)",
                                              fontSize: "0.8rem",
                                            }}
                                          />
                                          <input
                                            type="text"
                                            placeholder="YouTube URL"
                                            value={inlineVideoUrl}
                                            onChange={(e) => setInlineVideoUrl(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                              padding: "6px 8px",
                                              border: "1px solid var(--glass-border)",
                                              borderRadius: "4px",
                                              background: "var(--background)",
                                              color: "var(--foreground)",
                                              fontSize: "0.8rem",
                                            }}
                                          />
                                        </div>
                                        <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setAddVideoSubTopicId(null); setInlineVideoTitle(""); setInlineVideoUrl(""); }}
                                            style={{
                                              padding: "4px 10px",
                                              background: "var(--glass-border)",
                                              color: "var(--foreground)",
                                              border: "none",
                                              borderRadius: "4px",
                                              cursor: "pointer",
                                              fontSize: "0.8rem",
                                            }}
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleAddVideoToSubTopic(mainTopic.id, subTopic.id); }}
                                            disabled={!inlineVideoTitle.trim() || !inlineVideoUrl.trim()}
                                            style={{
                                              padding: "4px 10px",
                                              background: (inlineVideoTitle.trim() && inlineVideoUrl.trim()) ? "var(--primary)" : "var(--text-muted)",
                                              color: "white",
                                              border: "none",
                                              borderRadius: "4px",
                                              cursor: (inlineVideoTitle.trim() && inlineVideoUrl.trim()) ? "pointer" : "not-allowed",
                                              fontSize: "0.8rem",
                                              fontWeight: "600",
                                            }}
                                          >
                                            Add
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setAddVideoSubTopicId(subTopic.id); }}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          padding: "6px 10px",
                                          background: "transparent",
                                          border: "1px dashed var(--glass-border)",
                                          borderRadius: "6px",
                                          cursor: "pointer",
                                          color: "var(--text-muted)",
                                          fontSize: "0.8rem",
                                          width: "100%",
                                          justifyContent: "center",
                                          transition: "all 0.2s ease",
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--glass-border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                                      >
                                        <Video size={14} />
                                        <Plus size={12} />
                                        Add Video
                                      </button>
                                    )}
                                  </div>
                                )}
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
