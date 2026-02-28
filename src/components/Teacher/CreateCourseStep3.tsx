"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Calendar } from "lucide-react";
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
  
  const [videoOptions, setVideoOptions] = useState<LibraryNode[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  // Publish frequency controls
  const [publishFreqMode, setPublishFreqMode] = useState<"interval" | "dayOfWeek">("interval");
  const [publishIntervalDays, setPublishIntervalDays] = useState(7);
  const [publishDayOfWeek, setPublishDayOfWeek] = useState(0); // 0 = Sunday
  const [publishStartDate, setPublishStartDate] = useState("");
  
  // Manual date overrides for first-level items
  const [dateOverrides, setDateOverrides] = useState<Record<string, string>>({});

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
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
  const calculatePublishDate = (index: number): Date => {
    const startDate = publishStartDate ? new Date(publishStartDate) : new Date();
    const date = new Date(startDate);

    if (publishFreqMode === "interval") {
      date.setDate(date.getDate() + index * publishIntervalDays);
    } else {
      // Day of week mode
      const targetDay = publishDayOfWeek;
      const currentDay = date.getDay();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      if (daysToAdd === 0 && index > 0) daysToAdd = 7;
      date.setDate(date.getDate() + daysToAdd + (index - (index > 0 ? 1 : 0)) * 7);
    }

    return date;
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

        // Fetch full catalog with verbose=1
        const topicsResponse = await fetch("/api/teacher/starter-catalog?verbose=1", { headers });
        const videoResponse = await fetch("/api/teacher/video-library", { headers });

        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          setTopicOptions(Array.isArray(topicData.topics) ? topicData.topics : []);
        }

        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          setVideoOptions(nodes.filter((node) => node.type !== "folder" && Boolean(node.url)));
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    initStep();
  }, [courseId]);

  const handleSaveAndContinue = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();

      // Import selected topics
      if (selectedTopicIds.length > 0) {
        // Filter to only main topic IDs (those without containing subtopics from other main topics)
        const mainTopicIds = topicOptions
          .filter(topic => selectedTopicIds.includes(topic.id))
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

      // Add selected library videos
      const selectedVideoNodes = videoOptions.filter((node) => selectedVideoIds.includes(node.id));
      if (selectedVideoNodes.length > 0) {
        for (const node of selectedVideoNodes) {
          const addVideoResponse = await fetch(`/api/teacher/courses/${courseId}/curriculum`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              title: node.title,
              type: node.type,
              duration: node.duration,
              url: node.url,
              parentId: null,
            }),
          });

          if (!addVideoResponse.ok) {
            const addVideoError = await addVideoResponse.json();
            throw new Error(addVideoError.error || `Failed to add video: ${node.title}`);
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
          <p className={styles.subtitle}>Step 3 of 4: Select modules and media library items</p>
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
        {/* Publish Frequency Controls */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Publish Frequency</h2>
          <p className={styles.helperText}>Set how frequently first-level items will be published after selection.</p>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.9rem", fontWeight: "600" }}>Mode</label>
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
                }}
              >
                <option value="interval">X Days Interval</option>
                <option value="dayOfWeek">Specific Day of Week</option>
              </select>
            </div>

            {publishFreqMode === "interval" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: "600" }}>Days Between Items</label>
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
                  }}
                >
                  {[1, 2, 3, 4, 5, 7, 10].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "0.9rem", fontWeight: "600" }}>Release Day</label>
                <select
                  value={publishDayOfWeek}
                  onChange={(e) => setPublishDayOfWeek(Number(e.target.value))}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.95rem",
                  }}
                >
                  {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "0.9rem", fontWeight: "600" }}>Start Date</label>
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
              }}
            />
          </div>
        </div>

        {/* Module Selection */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Module Selection</h2>
          <p className={styles.helperText}>Select modules to import. All sub-topics will be included when you check a main module.</p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {topicOptions.length === 0 && <p className={styles.emptyText}>No starter modules available.</p>}
            
            {topicOptions.map((mainTopic) => {
              const isExpanded = expandedTopics.includes(mainTopic.id);
              const allSubSelected = mainTopic.subTopics.every(st => selectedTopicIds.includes(st.id));
              const anySubSelected = mainTopic.subTopics.some(st => selectedTopicIds.includes(st.id));

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
                    <span>{mainTopic.title}</span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                      {mainTopic.subTopics.length} sub-topics
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ paddingLeft: "28px", paddingRight: "14px", paddingBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {mainTopic.subTopics.map((subTopic) => (
                        <label
                          key={subTopic.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTopicIds.includes(subTopic.id)}
                            onChange={() => toggleSubTopicSelection(subTopic.id)}
                          />
                          <span>{subTopic.title}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {subTopic.videos.length} videos
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Publish Dates Preview */}
        {firstLevelItems.length > 0 && (
          <div className={styles.contentCard}>
            <h2 className={styles.contentTitle}>Publish Schedule Preview</h2>
            <p className={styles.helperText}>Review and adjust publish dates for first-level items. You can edit each date individually.</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {firstLevelItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    padding: "12px 14px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "10px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-muted)" }}>
                    #{idx + 1}
                  </span>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "600" }}>{item.title}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{item.mainTopicTitle}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Calendar size={16} style={{ color: "var(--primary)" }} />
                    <input
                      type="date"
                      value={dateOverrides[item.id] || item.calculatedDate}
                      onChange={(e) =>
                        setDateOverrides(prev => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      style={{
                        padding: "6px 10px",
                        border: "1px solid var(--glass-border)",
                        borderRadius: "6px",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontSize: "0.9rem",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Video Library Options */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Video Library Options</h2>
          <p className={styles.helperText}>Pick videos/documents from your existing media library.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {videoOptions.length === 0 && (
              <p className={styles.emptyText}>No video library items available. Add media first from Teacher Dashboard → Library.</p>
            )}
            {videoOptions.map((node) => (
              <label
                key={node.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedVideoIds.includes(node.id)}
                  onChange={() => {
                    if (selectedVideoIds.includes(node.id)) {
                      setSelectedVideoIds(prev => prev.filter(id => id !== node.id));
                    } else {
                      setSelectedVideoIds(prev => [...prev, node.id]);
                    }
                  }}
                />
                <div>
                  <strong>{node.title}</strong>
                  <p style={{ margin: "2px 0 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {node.type}{node.duration ? ` · ${node.duration}` : ""}
                  </p>
                </div>
              </label>
            ))}
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
            disabled={saving || (selectedTopicIds.length === 0 && selectedVideoIds.length === 0)}
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
