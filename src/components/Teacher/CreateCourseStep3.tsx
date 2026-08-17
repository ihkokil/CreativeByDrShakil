"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar, Plus, Folder, Video, X, Settings2, Repeat, LayoutList, ClipboardList, PlusCircle, Check } from "lucide-react";
import styles from "./CreateCourseStep3.module.css";
import { getPreviousTargetDay, generateModuleSchedule, generatePreviewSchedule } from "@/lib/module-scheduling";

export interface StarterItem {
  id: string;
  type: "folder" | "youtube" | "self-hosted" | "document" | "quiz" | string;
  title: string;
  url?: string;
  quizId?: string;
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

interface LinkedCourseQuiz {
  id: string;
  courseId: string;
  quizId: string;
  curriculumNodeId: string | null;
  sortOrder: number;
  quiz: {
    id: string;
    title: string;
    durationMinutes: number;
    numQuestionsToServe: number;
    status: string;
  } | null;
}

// Date Helpers
function getNextTargetDayString(targetDay: number): string {
  const d = new Date();
  const dayOfWeek = d.getDay();
  const diff = (targetDay - dayOfWeek + 7) % 7;
  d.setDate(d.getDate() + diff);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  
  const [courseStartDate, setCourseStartDate] = useState<string>("");
  const [previewDate, setPreviewDate] = useState<string>("");
  
  const [releaseMode, setReleaseMode] = useState<"fixed_interval" | "circular">("fixed_interval");
  const [targetDay, setTargetDay] = useState<number>(5);

  // Linked course quizzes state
  const [linkedQuizzes, setLinkedQuizzes] = useState<LinkedCourseQuiz[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
  const [quizModal, setQuizModal] = useState<{ open: boolean; targetNodeId: string | null; targetTitle: string } | null>(null);
  const [modalSelectedQuizIds, setModalSelectedQuizIds] = useState<string[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // Generated schedule: mapping topic ID to scheduled ISO Date string
  const [scheduleMap, setScheduleMap] = useState<Record<string, string>>({});

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const fetchLinkedQuizzes = async () => {
    if (!courseId) return;
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/quizzes`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLinkedQuizzes(data.quizzes || []);
      }
    } catch (e) {
      console.error("Failed to fetch linked quizzes", e);
    }
  };

  const handleOpenQuizModal = async (targetNodeId: string | null, targetTitle: string) => {
    setQuizModal({ open: true, targetNodeId, targetTitle });
    setModalLoading(true);
    try {
      const [allQuizzesRes, courseQuizzesRes] = await Promise.all([
        fetch('/api/quiz?limit=100', { headers: getAuthHeaders() }),
        fetch(`/api/teacher/courses/${courseId}/quizzes`, { headers: getAuthHeaders() }),
      ]);
      const allQuizzesData = allQuizzesRes.ok ? await allQuizzesRes.json() : { quizzes: [] };
      const courseQuizzesData = courseQuizzesRes.ok ? await courseQuizzesRes.json() : { quizzes: [] };

      setAvailableQuizzes(allQuizzesData.quizzes || []);
      const currentLinked = (courseQuizzesData.quizzes || []).filter(
        (cq: any) => cq.curriculumNodeId === targetNodeId
      );
      setModalSelectedQuizIds(currentLinked.map((cq: any) => cq.quizId));
    } catch (e) {
      console.error("Failed to load teacher quizzes for modal", e);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSaveQuizzes = async () => {
    if (!courseId || !quizModal) return;
    setModalSaving(true);
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/quizzes`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          quizIds: modalSelectedQuizIds,
          curriculumNodeId: quizModal.targetNodeId,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to link quizzes");
      }
      await fetchLinkedQuizzes();
      setQuizModal(null);
    } catch (err: any) {
      alert(err.message || "Failed to link quizzes");
    } finally {
      setModalSaving(false);
    }
  };

  const handleUnlinkQuiz = async (quizId: string) => {
    if (!courseId) return;
    if (!confirm("Are you sure you want to remove this quiz from this course?")) return;
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/quizzes?quizId=${quizId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setLinkedQuizzes(prev => prev.filter(q => q.quizId !== quizId));
      }
    } catch (e) {
      console.error("Failed to unlink quiz", e);
    }
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

  const buildHierarchyFromLibraryNodes = (nodes: LibraryNode[], courseTitle?: string): StarterMainTopic[] => {
    let topLevelFolders: LibraryNode[] = [];

    if (courseTitle) {
      const courseFolder = nodes.find(n => !n.parentId && n.type === "folder" && n.title.trim().toLowerCase() === courseTitle.trim().toLowerCase());
      if (courseFolder) {
        topLevelFolders = nodes.filter(n => n.parentId === courseFolder.id && n.title.trim().toLowerCase() !== "all resources");
      }
    }

    if (topLevelFolders.length === 0) {
      topLevelFolders = nodes.filter(n => !n.parentId && n.type === "folder" && n.title.trim().toLowerCase() !== "all resources");
    }
    
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
          const loadedMode = loadedCourseData.course?.releaseMode;
          if (loadedMode === 'circular' || loadedMode === 'fixed_interval') {
             setReleaseMode(loadedMode);
          }
          
          let initialTargetDay = 5;
          if (loadedCourseData.course?.releaseDaysOfWeek && loadedCourseData.course.releaseDaysOfWeek.length > 0) {
             initialTargetDay = loadedCourseData.course.releaseDaysOfWeek[0];
             setTargetDay(initialTargetDay);
          }

          if (loadedCourseData.course?.courseStartDate) {
            const d = new Date(loadedCourseData.course.courseStartDate);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setCourseStartDate(`${yyyy}-${mm}-${dd}`);
            setPreviewDate(`${yyyy}-${mm}-${dd}`);
          } else {
            const defaultDate = getNextTargetDayString(initialTargetDay);
            setCourseStartDate(defaultDate);
            setPreviewDate(defaultDate);
          }
        } else {
          const defaultDate = getNextTargetDayString(5);
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
          const libraryTopics = buildHierarchyFromLibraryNodes(nodes, loadedCourseData?.course?.title);
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
            
            let topicsToProcess = curriculum;
            const courseTitle = loadedCourseData?.course?.title || "";
            if (curriculum.length === 1 && curriculum[0].title && curriculum[0].title.trim().toLowerCase() === courseTitle.trim().toLowerCase()) {
                topicsToProcess = curriculum[0].children || [];
            }
            
            // Reconstruct chronological order from saved JSON
            topicsToProcess.forEach((topicNode: any) => {
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
        await fetchLinkedQuizzes();
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
    const snappedDay = getPreviousTargetDay(selectedDate, targetDay);

    const selectedModules = selectedTopicIds.map(id => {
      const topic = topicOptions.find(t => t.id === id);
      return {
        id,
        title: topic ? topic.title : "",
      };
    });

    const schedule = generateModuleSchedule(selectedModules, snappedDay, targetDay);

    const newScheduleMap: Record<string, string> = {};
    schedule.forEach(item => {
      newScheduleMap[item.id] = item.releaseAt;
    });

    setScheduleMap(newScheduleMap);
  }, [selectedTopicIds, courseStartDate, topicOptions, targetDay]);

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

    if (releaseMode === "circular") {
      return generatePreviewSchedule(scheduleToFilter, baseCourseDate, enrollmentDate, targetDay);
    } else {
      const snappedDay = getPreviousTargetDay(baseCourseDate, targetDay);
      return generateModuleSchedule(scheduleToFilter, snappedDay, targetDay);
    }
  }, [previewDate, courseStartDate, selectedTopicIds, targetDay, releaseMode]);

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

        const releaseAt = releaseMode === 'circular' ? null : (scheduleMap[topic.id] || null);

        return {
          id: topic.id,
          title: topic.title,
          type: "folder",
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
            releaseMode: releaseMode,
            releaseDaysOfWeek: [targetDay],
            courseStartDate: courseStartDate, // Keep original start date
            releaseStartAt: courseStartDate,
          }),
        });

        if (!scheduleResponse.ok) {
          const scheduleError = await scheduleResponse.json();
          throw new Error(scheduleError.error || "Failed to save publish schedule.");
        }

        const curriculumResponse = await fetch(`/api/teacher/courses/${courseId}/curriculum`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ curriculum: topicsPayload }),
        });

        if (!curriculumResponse.ok) {
          const curriculumError = await curriculumResponse.json();
          throw new Error(curriculumError.error || "Failed to save curriculum.");
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 className={styles.contentTitle} style={{ margin: 0 }}>Scheduled Sequence</h2>
            <button
              type="button"
              onClick={() => router.push(`/teacher/dashboard/courses/${courseId}/outline?tab=library`)}
              style={{
                padding: "10px 20px", background: "var(--primary)", color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.95rem", fontWeight: "600",
                boxShadow: "0 4px 12px rgba(var(--primary-rgb), 0.3)"
              }}
            >
              <Plus size={18} /> Add Modules
            </button>
          </div>

          <div style={{
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--glass-border)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            width: "100%"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "12px", marginBottom: "4px" }}>
              <Settings2 size={20} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: "600", letterSpacing: "0.5px" }}>Release Configuration</h3>
            </div>

            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", flex: "1", minWidth: "200px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  {releaseMode === 'circular' ? <Repeat size={14} /> : <LayoutList size={14} />} Release Mode
                </label>
                <div style={{ 
                  display: "flex", 
                  background: "rgba(255,255,255,0.03)", 
                  border: "1px solid rgba(255,255,255,0.1)", 
                  borderRadius: "8px", 
                  padding: "4px",
                  gap: "4px"
                }}>
                  <button
                    type="button"
                    onClick={() => setReleaseMode("fixed_interval")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: "6px",
                      background: releaseMode === "fixed_interval" ? "var(--primary)" : "transparent",
                      color: releaseMode === "fixed_interval" ? "white" : "var(--text-muted)",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Linear
                  </button>
                  <button
                    type="button"
                    onClick={() => setReleaseMode("circular")}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      border: "none",
                      borderRadius: "6px",
                      background: releaseMode === "circular" ? "var(--primary)" : "transparent",
                      color: releaseMode === "circular" ? "white" : "var(--text-muted)",
                      fontWeight: "600",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    Circular
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: "1", minWidth: "160px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={14} /> Module Release Day
                </label>
                <select 
                  value={targetDay}
                  onChange={(e) => {
                    const newDay = Number(e.target.value);
                    setTargetDay(newDay);
                    const nextDate = getNextTargetDayString(newDay);
                    setCourseStartDate(nextDate);
                    setPreviewDate(nextDate);
                  }}
                  style={{ 
                    background: "rgba(255,255,255,0.03)", color: "var(--foreground)", 
                    border: "1px solid rgba(255,255,255,0.1)", padding: "12px 14px", 
                    borderRadius: "8px", outline: "none", fontSize: "0.95rem",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                >
                  <option value={0}>Sunday</option>
                  <option value={1}>Monday</option>
                  <option value={2}>Tuesday</option>
                  <option value={3}>Wednesday</option>
                  <option value={4}>Thursday</option>
                  <option value={5}>Friday</option>
                  <option value={6}>Saturday</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", flex: "1", minWidth: "180px" }}>
                <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={14} /> Course Start Date
                </label>
                <div style={{ 
                  display: "flex", alignItems: "center", gap: "8px", 
                  background: "rgba(255,255,255,0.03)", padding: "10px 14px", 
                  borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
                  transition: "border-color 0.2s"
                }}>
                  <input
                    type="date"
                    value={courseStartDate}
                    onChange={(e) => setCourseStartDate(e.target.value)}
                    style={{ background: "transparent", color: "var(--foreground)", border: "none", fontSize: "0.95rem", width: "100%", outline: "none" }}
                  />
                </div>
              </div>

              {releaseMode === 'circular' && (
                <div style={{ display: "flex", flexDirection: "column", flex: "1", minWidth: "180px", position: "relative" }}>
                  <div style={{
                    position: "absolute", top: "-12px", right: "0", background: "var(--primary)", 
                    color: "white", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold",
                    letterSpacing: "0.5px", textTransform: "uppercase"
                  }}>Preview Only</div>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "600", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={14} /> Simulate Enrollment
                  </label>
                  <div style={{ 
                    display: "flex", alignItems: "center", gap: "8px", 
                    background: "rgba(var(--primary-rgb), 0.05)", padding: "10px 14px", 
                    borderRadius: "8px", border: "1px dashed var(--primary)"
                  }}>
                    <input
                      type="date"
                      value={previewDate}
                      min={courseStartDate}
                      onChange={(e) => setPreviewDate(e.target.value)}
                      style={{ background: "transparent", color: "var(--foreground)", border: "none", fontSize: "0.95rem", width: "100%", outline: "none" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {releaseMode === 'circular' ? (
            <p className={styles.helperText} style={{ marginBottom: "20px", color: "var(--primary)" }}>
              Previewing circular rotation for a student enrolling on {previewDate ? formatDisplayDate(new Date(Number(previewDate.split('-')[0]), Number(previewDate.split('-')[1]) - 1, Number(previewDate.split('-')[2]))) : ""}
            </p>
          ) : (
            <p className={styles.helperText} style={{ marginBottom: "20px", color: "var(--primary)" }}>
              Previewing linear sequence starting on {courseStartDate ? formatDisplayDate(new Date(Number(courseStartDate.split('-')[0]), Number(courseStartDate.split('-')[1]) - 1, Number(courseStartDate.split('-')[2]))) : ""}
            </p>
          )}

          {/* All Quizzes (Global / Always Available) Folder */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--glass-border)",
            borderRadius: "14px",
            padding: "18px 20px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px",
                  background: "var(--primary-color-alpha, rgba(237,28,40,0.15))",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)"
                }}>
                  <ClipboardList size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "1.05rem" }}>All Quizzes (Always Available)</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Quizzes in this folder are available to enrolled students from the beginning.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOpenQuizModal(null, "All Quizzes (Global)")}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", borderRadius: "8px",
                  background: "var(--primary)", color: "white",
                  border: "none", fontWeight: "600", fontSize: "0.85rem", cursor: "pointer"
                }}
              >
                <Plus size={16} /> Add Quiz
              </button>
            </div>

            {/* List of quizzes in All Quizzes */}
            {linkedQuizzes.filter(q => !q.curriculumNodeId).length === 0 ? (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                No global quizzes added yet. Click "Add Quiz" to attach quizzes here.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                {linkedQuizzes.filter(q => !q.curriculumNodeId).map(lq => (
                  <div key={lq.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", background: "rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <ClipboardList size={16} style={{ color: "var(--primary)" }} />
                      <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>{lq.quiz?.title || "Quiz"}</span>
                      {lq.quiz?.durationMinutes && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>({lq.quiz.durationMinutes} min)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkQuiz(lq.quizId)}
                      style={{
                        background: "transparent", border: "none", color: "var(--text-muted)",
                        cursor: "pointer", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem"
                      }}
                      title="Remove quiz"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

                const moduleQuizzes = linkedQuizzes.filter(q => q.curriculumNodeId === mod.id);

                return (
                  <div key={`${mod.id}-${index}`} style={{ 
                    display: "flex", flexDirection: "column",
                    padding: "16px 20px", border: "1px solid var(--glass-border)", borderRadius: "12px",
                    background: "rgba(0,0,0,0.1)", gap: "12px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                            Module #{mod.originalIndex + 1} &bull; {topic.subTopics.length} items &bull; {moduleQuizzes.length} {moduleQuizzes.length === 1 ? 'Quiz' : 'Quizzes'}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenQuizModal(mod.id, topic.title)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: "4px",
                            padding: "6px 12px", borderRadius: "6px",
                            background: "rgba(255,255,255,0.06)", color: "var(--text-primary)",
                            border: "1px solid var(--glass-border)", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer"
                          }}
                        >
                          <Plus size={14} /> Add Quiz
                        </button>
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
                    </div>

                    {/* Show module quizzes if any */}
                    {moduleQuizzes.length > 0 && (
                      <div style={{
                        display: "flex", flexDirection: "column", gap: "6px",
                        padding: "10px 14px", background: "rgba(255,255,255,0.02)",
                        borderRadius: "8px", border: "1px dashed rgba(255,255,255,0.08)"
                      }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
                          Module Quizzes (Unlocks with this module)
                        </div>
                        {moduleQuizzes.map(mq => (
                          <div key={mq.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: "0.9rem"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <ClipboardList size={14} style={{ color: "var(--primary)" }} />
                              <span style={{ fontWeight: "500" }}>{mq.quiz?.title || "Quiz"}</span>
                              {mq.quiz?.durationMinutes && (
                                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>({mq.quiz.durationMinutes} min)</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleUnlinkQuiz(mq.quizId)}
                              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                              title="Remove quiz"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quiz Picker Modal */}
        {quizModal && quizModal.open && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "20px"
          }}>
            <div style={{
              background: "var(--card-bg, #1a1a1a)", border: "1px solid var(--glass-border)",
              borderRadius: "16px", width: "100%", maxWidth: "560px", maxHeight: "80vh",
              display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "18px 24px", borderBottom: "1px solid var(--glass-border)"
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>Add Quizzes</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    Target: <strong style={{ color: "var(--primary)" }}>{quizModal.targetTitle}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuizModal(null)}
                  style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                {modalLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>Loading your published quizzes...</div>
                ) : availableQuizzes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    No quizzes found. Please create and publish quizzes first in Teacher Dashboard &gt; Quizzes.
                  </div>
                ) : (
                  availableQuizzes.map((q: any) => {
                    const isSelected = modalSelectedQuizIds.includes(q.id);
                    const isLinkedElsewhere = q.courseId && q.courseId !== courseId;

                    return (
                      <div
                        key={q.id}
                        onClick={() => {
                          if (isLinkedElsewhere) return;
                          if (isSelected) {
                            setModalSelectedQuizIds(prev => prev.filter(id => id !== q.id));
                          } else {
                            setModalSelectedQuizIds(prev => [...prev, q.id]);
                          }
                        }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", borderRadius: "10px",
                          border: `1px solid ${isSelected ? "var(--primary)" : "var(--glass-border)"}`,
                          background: isSelected ? "var(--primary-color-alpha, rgba(237,28,40,0.1))" : "rgba(255,255,255,0.02)",
                          cursor: isLinkedElsewhere ? "not-allowed" : "pointer",
                          opacity: isLinkedElsewhere ? 0.5 : 1,
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "20px", height: "20px", borderRadius: "4px",
                            border: `2px solid ${isSelected ? "var(--primary)" : "rgba(255,255,255,0.3)"}`,
                            background: isSelected ? "var(--primary)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", color: "white"
                          }}>
                            {isSelected && <Check size={14} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>{q.title}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              {q.numQuestionsToServe || (q._count?.questions ?? 0)} questions &bull; {q.durationMinutes ? `${q.durationMinutes} min` : 'Unlimited'}
                              {isLinkedElsewhere && <span style={{ color: "#ef4444", marginLeft: "8px" }}>(Linked to {q.courseName || 'another course'})</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{
                display: "flex", justifyContent: "flex-end", gap: "10px",
                padding: "16px 24px", borderTop: "1px solid var(--glass-border)", background: "rgba(0,0,0,0.2)"
              }}>
                <button
                  type="button"
                  onClick={() => setQuizModal(null)}
                  style={{
                    padding: "8px 16px", borderRadius: "8px",
                    background: "transparent", color: "var(--text-muted)",
                    border: "1px solid var(--glass-border)", cursor: "pointer", fontWeight: "600"
                  }}
                  disabled={modalSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuizzes}
                  style={{
                    padding: "8px 20px", borderRadius: "8px",
                    background: "var(--primary)", color: "white",
                    border: "none", cursor: "pointer", fontWeight: "600"
                  }}
                  disabled={modalSaving || modalLoading}
                >
                  {modalSaving ? "Saving..." : "Save Selection"}
                </button>
              </div>
            </div>
          </div>
        )}

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
