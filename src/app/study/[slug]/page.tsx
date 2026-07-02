"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../Study.module.css";
import {
    ChevronRight,
    FileText,
    Video,
    ArrowLeft,
    Lock,
    Menu,
    X,
} from "lucide-react";
import Link from "next/link";
import CourseCurriculum, { CurriculumNode } from "@/components/Course/CourseCurriculum";
import { useParams } from "next/navigation";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import LessonPlayer from "@/components/Study/LessonPlayer";
import Loader from "@/components/UI/Loader";
import { getStudentModuleView } from "@/lib/module-scheduling";

const findFirstPlayableNode = (nodes: CurriculumNode[]): CurriculumNode | null => {
    for (const node of nodes) {
        if (node.type !== "folder" && !node.locked) {
            return node;
        }
        if (node.children?.length) {
            const found = findFirstPlayableNode(node.children);
            if (found) return found;
        }
    }
    return null;
};

const collectLessonNodes = (nodes: CurriculumNode[]): CurriculumNode[] => {
    const lessons: CurriculumNode[] = [];

    const walk = (list: CurriculumNode[]) => {
        list.forEach((node) => {
            if (node.type !== "folder") {
                lessons.push(node);
            }
            if (node.children?.length) {
                walk(node.children);
            }
        });
    };

    walk(nodes);
    return lessons;
};


export default function StudyCoursePage() {
    const params = useParams<{ slug: string }>();
    const slug = params?.slug;

    const [courseTitle, setCourseTitle] = useState("Study Course");
    const [curriculum, setCurriculum] = useState<CurriculumNode[]>([]);
    const [activeLesson, setActiveLesson] = useState<CurriculumNode | null>(null);
    const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
    const [markingComplete, setMarkingComplete] = useState(false);
    const [progressError, setProgressError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadCurriculum = async () => {
            if (!slug) return;

            setLoading(true);
            setError(null);
            setProgressError(null);
            try {
                const token = localStorage.getItem("auth_token");
                const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
                const [curriculumResponse, progressResponse] = await Promise.all([
                    fetch(`/api/study/courses/${slug}/curriculum`, { method: "GET", headers }),
                    fetch(`/api/study/courses/${slug}/progress`, { method: "GET", headers }),
                ]);

                const curriculumData = await curriculumResponse.json();
                if (!curriculumResponse.ok) {
                    throw new Error(curriculumData.error || "Failed to load study curriculum.");
                }

                const progressData = progressResponse.ok ? await progressResponse.json() : null;

                if (cancelled) return;

                const nextCurriculum = Array.isArray(curriculumData.curriculum) ? curriculumData.curriculum : [];
                const eDate = curriculumData.enrollmentDate || null;
                setCourseTitle(curriculumData.course?.title || "Study Course");
                setEnrollmentDate(eDate);
                setCurriculum(nextCurriculum);

                const initialCompleted = Array.isArray(progressData?.progress?.completedLessonIds)
                    ? progressData.progress.completedLessonIds
                    : collectLessonNodes(nextCurriculum)
                        .filter((node) => node.completed)
                        .map((node) => node.id);
                setCompletedLessonIds(initialCompleted);

                // Sort nextCurriculum to find initial active lesson correctly in visual order
                const scheduledModules = nextCurriculum.map((node: CurriculumNode) => ({
                    ...node,
                    releaseAt: node.availableAt || new Date(0).toISOString(),
                }));
                const parsedEnrollmentDate = eDate ? new Date(eDate) : new Date(0);
                const view = getStudentModuleView(scheduledModules, parsedEnrollmentDate, new Date());
                const sortedNextCurriculum = view.modules as unknown as CurriculumNode[];

                const firstPlayable = findFirstPlayableNode(sortedNextCurriculum);
                const firstIncompletePlayable = collectLessonNodes(sortedNextCurriculum).find(
                    (node: CurriculumNode) => node.type !== "folder" && !node.locked && !initialCompleted.includes(node.id)
                );
                setActiveLesson(firstIncompletePlayable || firstPlayable);
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || "Failed to load study curriculum.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadCurriculum();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    const breadcrumbs = useMemo(() => {
        if (!activeLesson) return "Select a lesson";
        return activeLesson.title;
    }, [activeLesson]);

    const handleVideoSelect = (node: CurriculumNode) => {
        if (node.locked) return;
        setActiveLesson(node);
        setProgressError(null);
        setSidebarOpen(false);
    };

    const sortedCurriculumWithProgress = useMemo(() => {
        const completedSet = new Set(completedLessonIds);

        const annotate = (nodes: CurriculumNode[]): CurriculumNode[] => {
            return nodes.map((node) => ({
                ...node,
                ...(node.type !== "folder" ? { completed: completedSet.has(node.id) } : {}),
                children: node.children?.length ? annotate(node.children) : node.children,
            }));
        };

        const annotated = annotate(curriculum);

        const scheduledModules = annotated.map((node: CurriculumNode) => ({
            ...node,
            releaseAt: node.availableAt || new Date(0).toISOString(),
        }));

        const parsedEnrollmentDate = enrollmentDate ? new Date(enrollmentDate) : new Date(0);
        const view = getStudentModuleView(scheduledModules, parsedEnrollmentDate, new Date());
        return view.modules as unknown as CurriculumNode[];
    }, [curriculum, completedLessonIds, enrollmentDate]);

    const lessonNodes = useMemo(() => collectLessonNodes(sortedCurriculumWithProgress), [sortedCurriculumWithProgress]);
    const unlockedLessons = useMemo(
        () => lessonNodes.filter((node) => !node.locked),
        [lessonNodes]
    );

    const progress = useMemo(() => {
        const totalCount = lessonNodes.length;
        const completedCount = completedLessonIds.filter((id) => lessonNodes.some((node) => node.id === id)).length;
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        return { totalCount, completedCount, percentage };
    }, [lessonNodes, completedLessonIds]);

    const activeLessonIndex = useMemo(
        () => unlockedLessons.findIndex((node) => node.id === activeLesson?.id),
        [unlockedLessons, activeLesson]
    );

    const previousLesson = activeLessonIndex > 0 ? unlockedLessons[activeLessonIndex - 1] : null;
    const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < unlockedLessons.length - 1
        ? unlockedLessons[activeLessonIndex + 1]
        : null;

    const handleMarkComplete = async () => {
        if (!slug || !activeLesson || activeLesson.locked || activeLesson.type === "folder") {
            return;
        }

        setMarkingComplete(true);
        setProgressError(null);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/study/courses/${slug}/progress`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ lessonNodeId: activeLesson.id }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to mark lesson complete.");
            }

            const updatedIds = Array.isArray(data.progress?.completedLessonIds)
                ? data.progress.completedLessonIds
                : [];
            setCompletedLessonIds(updatedIds);
        } catch (err: any) {
            setProgressError(err.message || "Could not update progress right now.");
        } finally {
            setMarkingComplete(false);
        }
    };

    // Replaced by sortedCurriculumWithProgress


    if (loading) {
        return <Loader text="Loading study workspace..." />;
    }

    if (error) {
        return (
            <div className={styles.layout}>
                <main className={styles.main}>
                    <div className={styles.contentArea}>
                        <div className={styles.mockVideo}>
                            <Lock size={60} />
                            <span>{error}</span>
                            <Link href="/courses" className={styles.completeBtn}>Browse Courses</Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            {sidebarOpen && (
                <div 
                    className={styles.sidebarOverlay} 
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarActive : ""}`}>
                <div className={styles.sidebarHeader}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" }}>
                        <Link href="/dashboard" className={styles.backBtn} style={{ marginBottom: 0 }}>
                            <ArrowLeft size={18} /> Exit Study
                        </Link>
                        <button 
                            className={styles.sidebarCloseBtn}
                            onClick={() => setSidebarOpen(false)}
                            aria-label="Close menu"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className={styles.courseTitle}>
                        <h3>{courseTitle}</h3>
                        <div className={styles.progressSection}>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: `${progress.percentage}%` }} />
                            </div>
                            <span>{progress.completedCount}/{progress.totalCount} completed ({progress.percentage}%)</span>
                        </div>
                    </div>
                </div>

                <div className={styles.curriculum}>
                    <CourseCurriculum
                        data={sortedCurriculumWithProgress}
                        onVideoSelect={handleVideoSelect}
                        activeNodeId={activeLesson?.id}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <button 
                            className={styles.menuToggleBtn} 
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            aria-label="Toggle curriculum menu"
                        >
                            <Menu size={20} />
                        </button>
                        <div className={styles.breadcrumbs}>
                            <span>{courseTitle}</span> <ChevronRight size={14} /> <span>{breadcrumbs}</span>
                        </div>
                    </div>
                    {activeLesson && !activeLesson.locked && activeLesson.type !== "folder" && (
                        <button
                            className={styles.completeBtn}
                            onClick={handleMarkComplete}
                            disabled={markingComplete}
                        >
                            {markingComplete ? "Saving..." : completedLessonIds.includes(activeLesson.id) ? "Completed" : "Mark as Complete"}
                        </button>
                    )}
                </header>

                <div className={styles.contentArea}>
                    {progressError && (
                        <div style={{ marginBottom: "16px", color: "#ef4444", fontWeight: 600 }}>{progressError}</div>
                    )}
                    <LessonPlayer 
                        lesson={activeLesson as any} 
                        nextLesson={() => {
                            if (nextLesson) setActiveLesson(nextLesson);
                        }}
                        onComplete={handleMarkComplete}
                    />

                </div>

                <footer className={styles.navBar}>
                    <button className={styles.navBtn} disabled={!previousLesson} onClick={() => previousLesson && setActiveLesson(previousLesson)}>
                        <ArrowLeft size={18} /> Previous Lesson
                    </button>
                    <button className={styles.navBtn} disabled={!nextLesson} onClick={() => nextLesson && setActiveLesson(nextLesson)}>
                        Next Lesson <ChevronRight size={18} />
                    </button>
                </footer>
            </main>
        </div>
    );
}
