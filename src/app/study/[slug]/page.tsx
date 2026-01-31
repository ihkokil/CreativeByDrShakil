"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../Study.module.css";
import {
    ChevronRight,
    PlayCircle,
    FileText,
    Video,
    ArrowLeft,
    Lock,
} from "lucide-react";
import Link from "next/link";
import MCQSection from "@/components/Study/MCQSection";
import CourseCurriculum, { CurriculumNode } from "@/components/Course/CourseCurriculum";
import { useParams } from "next/navigation";

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

export default function StudyCoursePage() {
    const params = useParams<{ slug: string }>();
    const slug = params?.slug;

    const [courseTitle, setCourseTitle] = useState("Study Course");
    const [curriculum, setCurriculum] = useState<CurriculumNode[]>([]);
    const [activeLesson, setActiveLesson] = useState<CurriculumNode | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadCurriculum = async () => {
            if (!slug) return;

            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem("auth_token");
                const response = await fetch(`/api/study/courses/${slug}/curriculum`, {
                    method: "GET",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || "Failed to load study curriculum.");
                }

                if (cancelled) return;

                const nextCurriculum = Array.isArray(data.curriculum) ? data.curriculum : [];
                setCourseTitle(data.course?.title || "Study Course");
                setCurriculum(nextCurriculum);
                setActiveLesson(findFirstPlayableNode(nextCurriculum));
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
    };

    if (loading) {
        return <div className={styles.layout}>Loading study workspace...</div>;
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
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href="/dashboard" className={styles.backBtn}>
                        <ArrowLeft size={18} /> Exit Study
                    </Link>
                    <div className={styles.courseTitle}>
                        <h3>{courseTitle}</h3>
                        <div className={styles.progressSection}>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: "0%" }} />
                            </div>
                            <span>Progress tracking in next update</span>
                        </div>
                    </div>
                </div>

                <div className={styles.curriculum}>
                    <CourseCurriculum
                        data={curriculum}
                        onVideoSelect={handleVideoSelect}
                        activeNodeId={activeLesson?.id}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.breadcrumbs}>
                        <span>{courseTitle}</span> <ChevronRight size={14} /> <span>{breadcrumbs}</span>
                    </div>
                    <button className={styles.completeBtn} disabled={!activeLesson}>Mark as Complete</button>
                </header>

                <div className={styles.contentArea}>
                    <div className={styles.videoPlayer}>
                        {activeLesson ? (
                            activeLesson.type === "youtube" && activeLesson.url ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={activeLesson.url.replace("watch?v=", "embed/")}
                                    title={activeLesson.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className={styles.iframePlayer}
                                />
                            ) : activeLesson.type === "self-hosted" && activeLesson.url ? (
                                <video controls className={styles.iframePlayer} src={activeLesson.url} />
                            ) : (
                                <div className={styles.mockVideo}>
                                    <FileText size={60} />
                                    <span>{activeLesson.title}</span>
                                </div>
                            )
                        ) : (
                            <div className={styles.mockVideo}>
                                <Video size={60} />
                                <span>No unlocked lessons are available yet.</span>
                            </div>
                        )}
                    </div>

                    {activeLesson && (
                        <article className={styles.article}>
                            <h1>{activeLesson.title}</h1>
                            <p>
                                Review this lesson and continue through the scheduled curriculum as each topic becomes available.
                            </p>
                        </article>
                    )}

                    <MCQSection />
                </div>

                <footer className={styles.navBar}>
                    <button className={styles.navBtn} disabled>
                        <ArrowLeft size={18} /> Previous Lesson
                    </button>
                    <button className={styles.navBtn} disabled>
                        Next Lesson <ChevronRight size={18} />
                    </button>
                </footer>
            </main>
        </div>
    );
}
