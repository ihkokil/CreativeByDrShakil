"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FolderOpen,
  Lock,
  Save,
  Users,
  PlayCircle,
  RotateCcw,
  CheckCircle,
  Calendar,
  Zap,
} from "lucide-react";
import { annotateCurriculumAvailability, BuilderNodeWithAvailability } from "@/lib/teacher-course-builder";
import styles from "./TeacherStudentsPage.module.css";

type CourseSummary = {
  id: string;
  slug: string | null;
  title: string;
  status: "draft" | "scheduled" | "published" | "archived";
  duration: string;
  imageUrl: string | null;
  category: { displayName: string } | null;
  instructors: Array<{ id: string; name: string; designation?: string | null }>;
  _count: { orders: number };
};

type StudentSummary = {
  id: string;
  fullName: string;
  email: string;
  profileImage: string | null;
  enrolledAt: string;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
};

type OverrideRow = {
  userId: string;
  lessonNodeId: string;
  availabilityMode: "inherit" | "available" | "locked";
  availableAt: string | null;
};

type TeacherStudentsResponse = {
  courses: CourseSummary[];
  selectedCourse: null | {
    id: string;
    title: string;
    slug: string | null;
    status: CourseSummary["status"];
    duration: string;
    imageUrl: string | null;
    category: { displayName: string } | null;
    curriculum: BuilderNodeWithAvailability[];
    releaseMode: string | null;
    releaseStartAt: string | null;
    releaseIntervalDays: number | null;
    releaseGroupsPerWeek: number | null;
    releaseGroupDates: Record<string, string>;
    computedReleaseGroupDates: Record<string, string>;
  };
  students: StudentSummary[];
  selectedStudentId: string | null;
  overrides: OverrideRow[];
  studentComputedDatesMap: Record<string, Record<string, string>>;
};

type DraftAvailability = {
  availabilityMode: "inherit" | "available" | "locked";
  availableAt: string;
};

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const toLocalInputDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const countLessons = (nodes: BuilderNodeWithAvailability[]): number => {
  return nodes.reduce((total, node) => {
    const current = node.type === "folder" ? 0 : 1;
    return total + current + (node.children?.length ? countLessons(node.children) : 0);
  }, 0);
};

export default function TeacherStudentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseIdParam = searchParams.get("courseId") || "";

  const [data, setData] = useState<TeacherStudentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [draftAvailability, setDraftAvailability] = useState<Record<string, DraftAvailability>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [customDelay, setCustomDelay] = useState("5");

  const handleBatchOverride = async (action: string) => {
    if (!selectedCourse || !selectedStudentId) return;
    
    const confirmMsg = action === 'all_available' 
      ? "Are you sure you want to make all modules available immediately for this student?"
      : `Are you sure you want to reset the schedule for this student using the "${action.replace('_', ' ')}" action?`;
      
    if (!window.confirm(confirmMsg)) return;

    try {
      setBatchLoading(true);
      setError(null);
      const response = await fetch("/api/teacher/students/batch-override", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          userId: selectedStudentId,
          action,
          customDelayDays: customDelay,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to apply batch schedule override.");
      }

      // Refresh data
      const refresh = await fetch(
        courseIdParam ? `/api/teacher/students?courseId=${encodeURIComponent(courseIdParam)}` : "/api/teacher/students",
        { headers: getAuthHeaders() }
      );
      const refreshed = (await refresh.json()) as TeacherStudentsResponse & { error?: string };
      if (refresh.ok) {
        setData(refreshed);
      }
    } catch (err: any) {
      setError(err.message || "Failed to apply batch override.");
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          courseIdParam ? `/api/teacher/students?courseId=${encodeURIComponent(courseIdParam)}` : "/api/teacher/students",
          { headers: getAuthHeaders() }
        );
        const payload = (await response.json()) as TeacherStudentsResponse & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load student data.");
        }

        if (!cancelled) {
          setData(payload);
          setSelectedStudentId(payload.selectedStudentId || payload.students[0]?.id || "");
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          setError(fetchError.message || "Failed to load student data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [courseIdParam]);

  const selectedCourse = data?.selectedCourse || null;
  const selectedStudent = data?.students.find((student) => student.id === selectedStudentId) || null;
  const selectedStudentOverrides = useMemo(
    () => data?.overrides.filter((override) => override.userId === selectedStudentId) || [],
    [data?.overrides, selectedStudentId]
  );

  const selectedStudentCurriculum = useMemo(() => {
    if (!selectedCourse || !selectedStudentId) return [];

    const studentComputedDates = (data as any)?.studentComputedDatesMap?.[selectedStudentId] || selectedCourse.computedReleaseGroupDates || {};

    return annotateCurriculumAvailability(
      selectedCourse.curriculum,
      studentComputedDates,
      new Date(),
      selectedStudentOverrides.map((override) => ({
        lessonNodeId: override.lessonNodeId,
        availabilityMode: override.availabilityMode,
        availableAt: override.availableAt,
      }))
    );
  }, [selectedCourse, selectedStudentOverrides, selectedStudentId, data]);

  useEffect(() => {
    if (!selectedCourse) {
      setDraftAvailability({});
      return;
    }

    const nextDrafts: Record<string, DraftAvailability> = {};
    const currentOverrideMap = new Map(selectedStudentOverrides.map((override) => [override.lessonNodeId, override]));

    const walk = (nodes: BuilderNodeWithAvailability[]) => {
      nodes.forEach((node) => {
        const override = currentOverrideMap.get(node.id);
        nextDrafts[node.id] = {
          availabilityMode: override?.availabilityMode || "inherit",
          availableAt: toLocalInputDateTime(override?.availableAt || node.availableAt || ""),
        };
        if (node.children?.length) {
          walk(node.children);
        }
      });
    };

    walk(selectedStudentCurriculum);
    setDraftAvailability(nextDrafts);
  }, [selectedStudentCurriculum, selectedStudentOverrides]);

  const selectedCourseStats = useMemo(() => {
    if (!selectedCourse) {
      return { students: 0, published: 0, lessons: 0 };
    }

    return {
      students: data?.students.length || 0,
      published: selectedCourse.status === "published" ? 1 : 0,
      lessons: countLessons(selectedCourse.curriculum || []),
    };
  }, [data?.students.length, selectedCourse]);

  const handleSelectCourse = (id: string) => {
    if (id === courseIdParam) return;
    router.replace(`/teacher/dashboard/students?courseId=${id}`);
  };

  const handleDraftChange = (nodeId: string, partial: Partial<DraftAvailability>) => {
    setDraftAvailability((prev) => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || { availabilityMode: "inherit", availableAt: "" }),
        ...partial,
      },
    }));
  };

  const handleSaveOverride = async (nodeId: string) => {
    if (!selectedCourse || !selectedStudentId) return;

    const draft = draftAvailability[nodeId];
    if (!draft) return;

    try {
      setSavingKey(nodeId);
      const response = await fetch("/api/teacher/students", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          userId: selectedStudentId,
          lessonNodeId: nodeId,
          availabilityMode: draft.availabilityMode,
          availableAt: draft.availabilityMode === "available" ? draft.availableAt || null : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save availability override.");
      }

      const refresh = await fetch(
        courseIdParam ? `/api/teacher/students?courseId=${encodeURIComponent(courseIdParam)}` : "/api/teacher/students",
        { headers: getAuthHeaders() }
      );
      const refreshed = (await refresh.json()) as TeacherStudentsResponse & { error?: string };
      if (refresh.ok) {
        setData(refreshed);
      }
    } catch (saveError: any) {
      setError(saveError.message || "Failed to save availability override.");
    } finally {
      setSavingKey(null);
    }
  };

  const renderNode = (node: BuilderNodeWithAvailability, depth: number) => {
    const draft = draftAvailability[node.id] || {
      availabilityMode: node.availabilityMode || "inherit",
      availableAt: toLocalInputDateTime(node.availabilityOverrideAt || node.availableAt || ""),
    };

    return (
      <div key={node.id} className={styles.nodeWrap} style={{ marginLeft: `${depth * 18}px` }}>
        <div className={styles.nodeRow}>
          <div className={styles.nodeMeta}>
            {node.type === "folder" ? <FolderOpen size={16} /> : <PlayCircle size={16} />}
            <div>
              <strong>{node.title}</strong>
              <div className={styles.nodeSubmeta}>
                <span>{node.type}</span>
                {node.duration && <span>{node.duration}</span>}
                {node.locked ? <span className={styles.lockedTag}>Locked</span> : <span className={styles.openTag}>Open</span>}
                {node.availableAt && <span>{formatDateTime(node.availableAt)}</span>}
              </div>
            </div>
          </div>

          <div className={styles.nodeControls}>
            <select
              value={draft.availabilityMode}
              onChange={(event) => handleDraftChange(node.id, { availabilityMode: event.target.value as DraftAvailability["availabilityMode"] })}
            >
              <option value="inherit">Inherit</option>
              <option value="available">Available</option>
              <option value="locked">Locked</option>
            </select>

            {draft.availabilityMode === "available" && (
              <input
                type="datetime-local"
                value={draft.availableAt}
                onChange={(event) => handleDraftChange(node.id, { availableAt: event.target.value })}
              />
            )}

            <button
              type="button"
              className={styles.saveBtn}
              onClick={() => handleSaveOverride(node.id)}
              disabled={savingKey === node.id}
            >
              <Save size={14} /> {savingKey === node.id ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {node.children?.length ? (
          <div className={styles.children}>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading students workspace...</div>;
  }

  if (error && !data) {
    return (
      <div className={styles.emptyState}>
        <Lock size={48} />
        <h2>Students workspace unavailable</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <aside className={styles.courseRail}>
        <div className={styles.railHeader}>
          <div>
            <p className={styles.eyebrow}>Teacher Students</p>
            <h1>Courses</h1>
          </div>
        </div>

        <div className={styles.courseList}>
          {data?.courses.map((course) => (
            <button
              key={course.id}
              type="button"
              className={`${styles.courseCard} ${course.id === selectedCourse?.id ? styles.courseCardActive : ""}`}
              onClick={() => handleSelectCourse(course.id)}
            >
              <div className={styles.courseThumb}>
                <Image src={course.imageUrl || "/placeholder.svg"} alt={course.title} fill unoptimized />
              </div>
              <div className={styles.courseCardBody}>
                <div className={styles.courseCardTopRow}>
                  <span className={styles.courseCategory}>{course.category?.displayName || "General"}</span>
                  <span className={styles.statusPill}>{course.status}</span>
                </div>
                <h3>{course.title}</h3>
                <div className={styles.courseMeta}>
                  <span><Users size={14} /> {course._count.orders} Students</span>
                  <span><Clock size={14} /> {course.duration}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className={styles.main}>
        {!selectedCourse ? (
          <div className={styles.emptyState}>
            <BookOpen size={48} />
            <h2>No course selected</h2>
            <p>Select a course to view enrolled students and manage module availability.</p>
          </div>
        ) : (
          <>
            <header className={styles.headerCard}>
              <div>
                <p className={styles.eyebrow}>Course Students</p>
                <h1>{selectedCourse.title}</h1>
                <p className={styles.subtitle}>
                  {selectedCourse.category?.displayName || "General"} · {selectedCourse.status}
                </p>
              </div>
              <button type="button" className={styles.secondaryBtn} onClick={() => router.push("/teacher/dashboard?tab=overview")}>
                <ChevronRight size={16} /> Back to Dashboard
              </button>
            </header>

            {error && <div className={styles.errorBanner}>{error}</div>}

            <section className={styles.statsGrid}>
              <div className={styles.statCard}><strong>{selectedCourseStats.students}</strong><span>Students</span></div>
              <div className={styles.statCard}><strong>{selectedCourseStats.lessons}</strong><span>Available Modules</span></div>
              <div className={styles.statCard}><strong>{selectedCourseStats.published ? 1 : 0}</strong><span>Published</span></div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Enrolled Students</h2>
                <p>Progress is read-only. Module availability overrides can be applied per student.</p>
              </div>

              <div className={styles.studentGrid}>
                {data?.students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={`${styles.studentCard} ${student.id === selectedStudentId ? styles.studentCardActive : ""}`}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <div className={styles.avatarWrap}>
                      {student.profileImage ? (
                        <Image src={student.profileImage} alt={student.fullName} fill unoptimized />
                      ) : (
                        <span>{initials(student.fullName)}</span>
                      )}
                    </div>
                    <div className={styles.studentCardBody}>
                      <strong>{student.fullName}</strong>
                      <span>{student.email}</span>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${student.progressPercent}%` }} />
                      </div>
                      <p>{student.completedCount}/{student.totalCount} completed</p>
                    </div>
                    <div className={styles.progressBadge}>{student.progressPercent}%</div>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2>Module Availability</h2>
                  <p>
                    {selectedStudent
                      ? `Adjust availability for ${selectedStudent.fullName}. Folder-level rules apply to nested content.`
                      : "Select a student to edit module availability."}
                  </p>
                </div>
                {selectedStudent && <div className={styles.selectedStudentChip}>{selectedStudent.fullName}</div>}
              </div>

              {!selectedStudent ? (
                <div className={styles.emptyInline}>Select a student above to manage their module schedule.</div>
              ) : (
                <div className={styles.treeWrap}>
                  {/* Batch Schedule Override Panel */}
                  <div className={styles.batchBar}>
                    <span className={styles.batchLabel}>Batch Actions:</span>
                    <div className={styles.batchActions}>
                      <button 
                        className={styles.batchBtn} 
                        onClick={() => handleBatchOverride('original')}
                        disabled={batchLoading}
                        title="Reset to original course start date schedule"
                      >
                        <RotateCcw size={14} /> Original
                      </button>
                      <button 
                        className={styles.batchBtn} 
                        onClick={() => handleBatchOverride('all_available')}
                        disabled={batchLoading}
                        title="Unlock all modules immediately"
                      >
                        <CheckCircle size={14} /> All Available
                      </button>
                      <button 
                        className={styles.batchBtn} 
                        onClick={() => handleBatchOverride('weekly')}
                        disabled={batchLoading}
                        title="Set 7-day interval from enrollment"
                      >
                        <Calendar size={14} /> Weekly
                      </button>
                      <div className={styles.batchGroup}>
                        <button 
                          className={styles.batchBtn} 
                          onClick={() => handleBatchOverride('custom_delay')}
                          disabled={batchLoading}
                          title="Set custom interval from enrollment"
                        >
                          <Zap size={14} /> Set Delay:
                        </button>
                        <input 
                          type="number" 
                          className={styles.batchInput}
                          value={customDelay}
                          onChange={(e) => setCustomDelay(e.target.value)}
                          min="1"
                        />
                        <span className={styles.batchLabel}>days</span>
                      </div>
                    </div>
                    {batchLoading && <span className={styles.eyebrow} style={{ margin: 0, marginLeft: 'auto' }}>Applying...</span>}
                  </div>

                  {selectedStudentCurriculum.map((node) => renderNode(node, 0))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
