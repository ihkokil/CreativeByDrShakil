"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Plus, Folder, Video, X } from "lucide-react";
import styles from "./CreateCourseStep3.module.css";
import { getPreviousFriday, generateModuleSchedule, generatePreviewSchedule } from "@/lib/module-scheduling";

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

// Date Helpers
function getNextFridayString(): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const daysToAdd = daysUntilFriday === 0 ? 7 : daysUntilFriday;
  d.setDate(d.getDate() + daysToAdd);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getPreviousOrCurrentFriday(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  return getPreviousFriday(d);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function CreateCourseStep3Content({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [topicOptions, setTopicOptions] = useState<StarterMainTopic[]>([]);
  // Chronological order of selected topics
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  
  // Date Picker state
  const [courseStartDate, setCourseStartDate] = useState<string>("");
  const [previewDate, setPreviewDate] = useState<string>("");
  // Generated schedule: mapping topic ID to scheduled ISO Date string
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({});

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
      return {
        id: folder.id,
        title: folder.title,
        subTopics,
        source: "library",
      };
    });
  };

  useEffect(() => {
    if (!courseId) return;

    const initStep = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders();

        let loadedCourseData: any = null;

        const courseResponse = await fetch(`/api/teacher/courses/${courseId}`, { headers });
        if (courseResponse.ok) {
          loadedCourseData = await courseResponse.json();
          if (loadedCourseData.course?.courseStartDate) {
            const d = new Date(loadedCourseData.course.courseStartDate);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setCourseStartDate(`${yyyy}-${mm}-${dd}`);
            setPreviewDate(`${yyyy}-${mm}-${dd}`);
          } else {
            const defaultDate = getNextFridayString();
            setCourseStartDate(defaultDate);
            setPreviewDate(defaultDate);
          }
        } else {
          const defaultDate = getNextFridayString();
          setCourseStartDate(defaultDate);
          setPreviewDate(defaultDate);
        }

        const allTopics: StarterMainTopic[] = [];
        const seenIds = new Set<string>();
        const seenTitles = new Set<string>();

        const videoResponse = await fetch("/api/teacher/video-library", { headers });
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          const libraryTopics = buildHierarchyFromLibraryNodes(nodes);
          libraryTopics.forEach(lt => {
            const normTitle = lt.title ? lt.title.trim().toLowerCase() : '';
            if (!seenIds.has(lt.id) && !seenTitles.has(normTitle)) {
              allTopics.push(lt);
              seenIds.add(lt.id);
              if (normTitle) seenTitles.add(normTitle);
            }
          });
        }

        const initialSelectedOrder: string[] = [];

        // Process existing curriculum for persistence
        if (loadedCourseData?.course?.curriculumJson) {
          try {
            const curriculum = JSON.parse(loadedCourseData.course.curriculumJson);
            
            // Reconstruct chronological order from saved JSON
            curriculum.forEach((topicNode: any) => {
              let matchedId = topicNode.mediaVaultFolderId || topicNode.id;
              const normTitle = topicNode.title ? topicNode.title.trim().toLowerCase() : '';
              
              // Fallback: match by title if the ID isn't found in our topic list
              if (!seenIds.has(matchedId)) {
                  const matchedByTitle = allTopics.find(t => t.title.trim().toLowerCase() === normTitle);
                  if (matchedByTitle) {
                      matchedId = matchedByTitle.id;
                  }
              }

              if (seenIds.has(matchedId)) {
                initialSelectedOrder.push(matchedId);
              } else if (!seenTitles.has(normTitle)) {
                 const convertNodeToItem = (node: any): StarterItem => ({
                  id: node.id,
                  type: node.type,
                  title: node.title,
                  url: node.url,
                  items: node.children ? node.children.map(convertNodeToItem) : undefined,
                 });
                 const customTopic: StarterMainTopic = {
                   id: topicNode.id,
                   title: topicNode.title,
                   subTopics: topicNode.children ? topicNode.children.map(convertNodeToItem) : [],
                   source: "custom",
                 };
                 allTopics.push(customTopic);
                 seenIds.add(topicNode.id);
                 if (normTitle) seenTitles.add(normTitle);
                 initialSelectedOrder.push(topicNode.id);
              }
            });
          } catch (e) {
            console.error("Failed to parse existing curriculum", e);
          }
        }

        setTopicOptions(allTopics);
        setSelectedTopicIds(initialSelectedOrder);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    initStep();
  }, [courseId]);

  // Recalculate schedule map whenever selected modules or course start date changes
  useEffect(() => {
    if (!courseStartDate) return;

    const [year, month, day] = courseStartDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    const snappedFriday = getPreviousFriday(selectedDate);

    const selectedModules = selectedTopicIds.map(id => {
      const topic = topicOptions.find(t => t.id === id);
      return {
        id,
        title: topic ? topic.title : "",
      };
    });

    const schedule = generateModuleSchedule(selectedModules, snappedFriday);

    const newScheduleMap: Record<string, string> = {};
    schedule.forEach(item => {
      newScheduleMap[item.id] = item.releaseAt;
    });

    setScheduleMap(newScheduleMap);
  }, [selectedTopicIds, courseStartDate, topicOptions]);

  // Calculate preview schedule based on previewDate
  const previewSchedule = useMemo(() => {
    if (!previewDate || !courseStartDate || selectedTopicIds.length === 0) return [];

    const [year, month, day] = previewDate.split("-").map(Number);
    const enrollmentDate = new Date(year, month - 1, day, 12, 0, 0, 0);
    
    const [cy, cm, cd] = courseStartDate.split("-").map(Number);
    const baseCourseDate = new Date(cy, cm - 1, cd, 12, 0, 0, 0);

    const scheduleToFilter = selectedTopicIds.map((id, index) => ({
      id,
      title: "",
      originalIndex: index
    }));

    const generated = generatePreviewSchedule(scheduleToFilter, baseCourseDate, enrollmentDate);
    return generated;
  }, [previewDate, courseStartDate, selectedTopicIds]);

  const toggleLibrarySelection = (topicId: string) => {
    if (selectedTopicIds.includes(topicId)) {
      setSelectedTopicIds(prev => prev.filter(id => id !== topicId));
    } else {
      setSelectedTopicIds(prev => [...prev, topicId]);
    }
  };

  const removeTopic = (topicId: string) => {
    setSelectedTopicIds(prev => prev.filter(id => id !== topicId));
  };

  const handleSaveAndContinue = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();

      // Ensure we preserve the chronological order by mapping over selectedTopicIds
      const topicsPayload = selectedTopicIds.map((topicId) => {
        const topic = topicOptions.find(t => t.id === topicId);
        if (!topic) return null;

        const releaseAt = scheduleMap[topic.id] || null;

        return {
          id: topic.id,
          title: topic.title,
          subTopics: topic.source === "library" ? undefined : topic.subTopics,
          mediaVaultFolderId: topic.source === "library" ? topic.id : undefined,
          source: topic.source,
          ...(releaseAt ? { releaseAt } : {}),
        };
      }).filter(Boolean);

      if (topicsPayload.length > 0) {
        const scheduleResponse = await fetch(`/api/teacher/courses/${courseId}/scheduling`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            releaseMode: "fixed_interval",
            courseStartDate: courseStartDate, // Keep original start date
            releaseStartAt: courseStartDate,
          }),
        });

        if (!scheduleResponse.ok) {
          const scheduleError = await scheduleResponse.json();
          throw new Error(scheduleError.error || "Failed to save publish schedule.");
        }

        const topicImportResponse = await fetch(`/api/teacher/courses/${courseId}/import-topics`, {
          method: "POST",
          headers,
          body: JSON.stringify({ topics: topicsPayload }),
        });

        if (!topicImportResponse.ok) {
          const topicError = await topicImportResponse.json();
          throw new Error(topicError.error || "Failed to import selected modules.");
        }
      }

      router.push(`/teacher/dashboard/courses/${courseId}/review`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save module and media options");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading options...</div>;
  }

  const isLibraryView = tab === "library";

  if (isLibraryView) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Module Library</h1>
            <p className={styles.subtitle}>Select folders to add to your course sequence.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/teacher/dashboard/courses/${courseId}/outline`)}
            style={{
              padding: "12px 32px", background: "var(--primary)", color: "white", border: "none",
              borderRadius: "10px", cursor: "pointer", fontWeight: "700", fontSize: "1.05rem",
              letterSpacing: "0.3px"
            }}
          >
            Done
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '24px' }}>
          {topicOptions.map(topic => {
            const isSelected = selectedTopicIds.includes(topic.id);
            const orderIndex = selectedTopicIds.indexOf(topic.id);
            
            return (
              <div 
                key={topic.id}
                onClick={() => toggleLibrarySelection(topic.id)}
                style={{
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                  background: isSelected ? 'rgba(var(--primary-rgb), 0.05)' : 'var(--background)',
                  padding: '20px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <Folder style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }} size={24} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>{topic.title}</h3>
                </div>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {topic.subTopics.length} items
                </p>
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: '16px', right: '16px', 
                    background: 'var(--primary)', color: 'white', 
                    width: '24px', height: '24px', borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.8rem', fontWeight: 'bold'
                  }}>
                    {orderIndex + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // SCHEDULE VIEW (Default)
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Modules & Scheduling</h1>
          <p className={styles.subtitle}>Step 3 of 4: Setup your chronological module sequence</p>
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
        
        {/* Module Selection & Scheduling UI */}
        <div className={styles.contentCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px" }}>
            <div>
              <h2 className={styles.contentTitle}>Scheduled Sequence</h2>
              <p className={styles.helperText} style={{ marginBottom: "12px", color: "var(--primary)" }}>
                Preview: What a student would see if they enroll on {previewDate ? formatDisplayDate(new Date(Number(previewDate.split('-')[0]), Number(previewDate.split('-')[1]) - 1, Number(previewDate.split('-')[2]))) : ""}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--glass-border)" }}>
                <Calendar style={{ color: "var(--primary)" }} size={20} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "4px" }}>Simulate Enrollment Date</label>
                  <input
                    type="date"
                    value={previewDate}
                    min={courseStartDate}
                    onChange={(e) => setPreviewDate(e.target.value)}
                    style={{
                      background: "transparent", color: "var(--foreground)", border: "none", 
                      fontSize: "1rem", fontWeight: "bold", cursor: "pointer", outline: "none"
                    }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/teacher/dashboard/courses/${courseId}/outline?tab=library`)}
              style={{
                padding: "12px 24px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "1rem", fontWeight: "600",
                boxShadow: "0 4px 12px rgba(var(--primary-rgb), 0.3)"
              }}
            >
              <Plus size={20} /> Add Modules
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {selectedTopicIds.length === 0 ? (
              <div style={{ 
                padding: "40px", textAlign: "center", border: "2px dashed var(--glass-border)", 
                borderRadius: "12px", color: "var(--text-muted)" 
              }}>
                <Folder size={48} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
                <h3>No modules selected</h3>
                <p>Click "Add Modules" to select folders from your library.</p>
              </div>
            ) : (
              previewSchedule.map((mod, index) => {
                const topic = topicOptions.find(t => t.id === mod.id);
                if (!topic) return null;
                const isoDate = mod.releaseAt;
                const [y, m, d] = isoDate ? isoDate.split('-').map(Number) : [0, 0, 0];
                const displayDate = isoDate ? formatDisplayDate(new Date(y, m - 1, d)) : "";

                return (
                  <div key={`${mod.id}-${index}`} style={{ 
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "16px 20px", border: "1px solid var(--glass-border)", borderRadius: "12px",
                    background: "rgba(0,0,0,0.1)"
                  }}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                      <div style={{ 
                        width: "180px", color: "var(--primary)", fontWeight: "600", fontSize: "0.95rem",
                        display: "flex", alignItems: "center", gap: "8px"
                      }}>
                        <Calendar size={16} /> {displayDate}
                      </div>
                      <div style={{ width: "2px", height: "30px", background: "var(--glass-border)" }} />
                      <div>
                        <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{topic.title}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
                          Module #{mod.originalIndex + 1} &bull; {topic.subTopics.length} items
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeTopic(mod.id)}
                      style={{ 
                        background: "transparent", border: "none", color: "var(--text-muted)", 
                        cursor: "pointer", padding: "8px", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                      title="Remove module"
                    >
                      <X size={20} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard/courses")}
            className={styles.cancelBtn}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/${courseId}/content`)
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

export default function CreateCourseStep3({ courseId }: { courseId?: string }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <CreateCourseStep3Content courseId={courseId} />
    </Suspense>
  );
}
