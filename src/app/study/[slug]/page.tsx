"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import styles from "../Study.module.css";
import { CurriculumNode } from "@/components/Course/CourseCurriculum";
import Loader from "@/components/UI/Loader";
import { getStudentModuleView } from "@/lib/module-scheduling";
import AuthModal from "@/components/Auth/AuthModal";
import StudyOutlineHub from "@/components/Study/StudyOutlineHub";
import StudyPlayerView from "@/components/Study/StudyPlayerView";

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
    const router = useRouter();
    const params = useParams<{ slug: string }>();
    const slug = params?.slug;
    const searchParams = useSearchParams();
    const lessonParam = searchParams ? searchParams.get("lesson") : null;

    const [courseTitle, setCourseTitle] = useState("Study Course");
    const [curriculum, setCurriculum] = useState<CurriculumNode[]>([]);
    const [activeLesson, setActiveLesson] = useState<CurriculumNode | null>(null);
    const [enrollmentDate, setEnrollmentDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
    const [markingComplete, setMarkingComplete] = useState(false);
    const [progressError, setProgressError] = useState<string | null>(null);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [lastVisitedLessonId, setLastVisitedLessonId] = useState<string | null>(null);

    // Initialize lastVisitedLessonId from localStorage on client
    useEffect(() => {
        if (typeof window !== "undefined" && slug) {
            const saved = localStorage.getItem(`last_lesson_${slug}`);
            if (saved) {
                setLastVisitedLessonId(saved);
            }
        }
    }, [slug]);

    useEffect(() => {
        if (error === "Unauthorized.") {
            const timer = setTimeout(() => {
                setAuthMode("login");
                setIsAuthOpen(true);
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [error]);

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

                // Check if a specific lesson was requested in URL
                if (lessonParam) {
                    const scheduledModules = nextCurriculum.map((node: CurriculumNode) => ({
                        ...node,
                        releaseAt: node.availableAt || new Date(0).toISOString(),
                    }));
                    const parsedEnrollmentDate = eDate ? new Date(eDate) : new Date(0);
                    const view = getStudentModuleView(scheduledModules, parsedEnrollmentDate, new Date());
                    const sortedNextCurriculum = view.modules as unknown as CurriculumNode[];

                    const targetLesson = collectLessonNodes(sortedNextCurriculum).find(
                        (node) => node.id === lessonParam && !node.locked
                    );
                    setActiveLesson(targetLesson || null);
                } else {
                    // Default to Course Outline Hub when no lesson parameter is specified
                    setActiveLesson(null);
                }
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

    // Keep activeLesson in sync with URL searchParams if slug is already loaded
    useEffect(() => {
        if (!loading && curriculum.length > 0) {
            if (lessonParam) {
                const allNodes = collectLessonNodes(curriculum);
                const found = allNodes.find((node) => node.id === lessonParam && !node.locked);
                setActiveLesson(found || null);
                if (found) {
                    setLastVisitedLessonId(found.id);
                    if (typeof window !== "undefined" && slug) {
                        localStorage.setItem(`last_lesson_${slug}`, found.id);
                    }
                }
            } else {
                setActiveLesson(null);
            }
        }
    }, [lessonParam, loading, curriculum, slug]);

    // Sorted curriculum with scheduling & completion annotations
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

    // Switch to a lesson
    const handleSelectLesson = useCallback((node: CurriculumNode) => {
        if (node.locked || node.type === "folder") return;
        setActiveLesson(node);
        setLastVisitedLessonId(node.id);
        if (typeof window !== "undefined" && slug) {
            localStorage.setItem(`last_lesson_${slug}`, node.id);
        }
        setProgressError(null);
        if (slug) {
            router.push(`/study/${slug}?lesson=${encodeURIComponent(node.id)}`, { scroll: false });
        }
    }, [slug, router]);

    // Return to Course Outline Hub
    const handleBackToOutline = useCallback(() => {
        setActiveLesson(null);
        setProgressError(null);
        if (slug) {
            router.push(`/study/${slug}`, { scroll: false });
        }
    }, [slug, router]);

    // Mark current lesson complete
    const handleMarkComplete = useCallback(async () => {
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

            if (data.success) {
                setCompletedLessonIds((prev) => Array.from(new Set([...prev, activeLesson.id])));
            }
        } catch (err: any) {
            setProgressError(err.message || "Could not update progress right now.");
        } finally {
            setMarkingComplete(false);
        }
    }, [slug, activeLesson]);

    if (loading) {
        return <Loader text="Loading study workspace..." />;
    }

    if (error) {
        const isUnauthorized = error === "Unauthorized.";
        return (
            <div className={styles.unauthorizedLayout}>
                <div className={styles.unauthorizedCard}>
                    <div className={styles.lockGlowContainer}>
                        <Lock size={40} className={styles.unauthorizedLockIcon} />
                    </div>
                    <h2 className={styles.unauthorizedTitle}>
                        {isUnauthorized ? "Access Locked" : "An Error Occurred"}
                    </h2>
                    <p className={styles.unauthorizedDescription}>
                        {isUnauthorized
                            ? "You need to be logged in to access the student study workspace."
                            : error}
                    </p>
                    <div className={styles.unauthorizedBtnGroup}>
                        {isUnauthorized && (
                            <button
                                className={styles.unauthorizedLoginBtn}
                                onClick={() => {
                                    setAuthMode("login");
                                    setIsAuthOpen(true);
                                }}
                            >
                                Sign In Now
                            </button>
                        )}
                        <Link href="/courses" className={styles.unauthorizedBrowseBtn}>
                            Browse Courses
                        </Link>
                    </div>
                </div>

                <AuthModal
                    isOpen={isAuthOpen}
                    onClose={() => setIsAuthOpen(false)}
                    defaultMode={authMode}
                    onSuccess={() => {
                        setIsAuthOpen(false);
                        window.location.reload();
                    }}
                />
            </div>
        );
    }

    // Render Focused Player View when an active lesson is selected
    if (activeLesson) {
        return (
            <StudyPlayerView
                courseTitle={courseTitle}
                curriculum={sortedCurriculumWithProgress}
                activeLesson={activeLesson}
                completedLessonIds={completedLessonIds}
                markingComplete={markingComplete}
                progressError={progressError}
                onBackToOutline={handleBackToOutline}
                onSelectLesson={handleSelectLesson}
                onMarkComplete={handleMarkComplete}
            />
        );
    }

    // Render Full-width Course Outline Hub (All Accordions Collapsed by default)
    return (
        <StudyOutlineHub
            courseTitle={courseTitle}
            curriculum={sortedCurriculumWithProgress}
            completedLessonIds={completedLessonIds}
            onSelectLesson={handleSelectLesson}
            activeLessonId={null}
            lastVisitedLessonId={lastVisitedLessonId}
            courseSlug={slug || ""}
        />
    );
}
