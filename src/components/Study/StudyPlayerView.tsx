"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
    ArrowLeft,
    ChevronRight,
    Check,
    CheckCheck,
    List,
    X,
    PlayCircle,
    FileText,
    HelpCircle,
    CheckCircle2,
    Lock,
    Clock,
} from "lucide-react";
import styles from "./StudyPlayerView.module.css";
import { CurriculumNode } from "@/components/Course/CourseCurriculum";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

const LessonPlayer = dynamic(() => import('@/components/Study/LessonPlayer'), { ssr: false });

interface Props {
    courseTitle: string;
    curriculum: CurriculumNode[];
    activeLesson: CurriculumNode;
    completedLessonIds: string[];
    markingComplete: boolean;
    progressError: string | null;
    onBackToOutline: () => void;
    onSelectLesson: (node: CurriculumNode) => void;
    onMarkComplete: () => void;
}

function collectPlayableLessons(nodes: CurriculumNode[]): CurriculumNode[] {
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
}

function findParentModule(nodes: CurriculumNode[], targetId: string): { moduleTitle: string; moduleLessons: CurriculumNode[] } | null {
    for (const node of nodes) {
        if (node.type === "folder") {
            const childrenLessons: CurriculumNode[] = [];
            let hasTarget = false;

            const check = (list: CurriculumNode[]) => {
                for (const item of list) {
                    if (item.type !== "folder") {
                        childrenLessons.push(item);
                        if (item.id === targetId) hasTarget = true;
                    }
                    if (item.children?.length) check(item.children);
                }
            };
            if (node.children?.length) check(node.children);

            if (hasTarget) {
                return { moduleTitle: node.title, moduleLessons: childrenLessons };
            }
        }
    }
    return null;
}

export default function StudyPlayerView({
    courseTitle,
    curriculum,
    activeLesson,
    completedLessonIds,
    markingComplete,
    progressError,
    onBackToOutline,
    onSelectLesson,
    onMarkComplete,
}: Props) {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);
    const isCompleted = completedSet.has(activeLesson.id);

    // Find parent module details
    const parentInfo = useMemo(() => {
        return findParentModule(curriculum, activeLesson.id) || {
            moduleTitle: courseTitle,
            moduleLessons: collectPlayableLessons(curriculum),
        };
    }, [curriculum, activeLesson.id, courseTitle]);

    // All unlocked lessons for linear prev/next
    const unlockedLessons = useMemo(() => {
        return collectPlayableLessons(curriculum).filter(l => !l.locked);
    }, [curriculum]);

    const activeLessonIndex = useMemo(() => {
        return unlockedLessons.findIndex(l => l.id === activeLesson.id);
    }, [unlockedLessons, activeLesson.id]);

    const previousLesson = activeLessonIndex > 0 ? unlockedLessons[activeLessonIndex - 1] : null;
    const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < unlockedLessons.length - 1
        ? unlockedLessons[activeLessonIndex + 1]
        : null;

    // Module-scoped position indicator
    const moduleIndex = useMemo(() => {
        return parentInfo.moduleLessons.findIndex(l => l.id === activeLesson.id);
    }, [parentInfo.moduleLessons, activeLesson.id]);

    const getLessonIcon = (type: string) => {
        if (type === 'quiz') return <HelpCircle size={15} style={{ color: '#a855f7', flexShrink: 0 }} />;
        if (type === 'document') return <FileText size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />;
        return <PlayCircle size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />;
    };

    return (
        <div className={styles.layout}>
            {/* Top Navigation Bar */}
            <header className={styles.topBar}>
                <div className={styles.topLeft}>
                    <button
                        className={styles.backToOutlineBtn}
                        onClick={onBackToOutline}
                        title="Return to all course accordions"
                        aria-label="Course Outline"
                    >
                        <ArrowLeft size={18} />
                        <span className={styles.backBtnText}>Course Outline</span>
                    </button>

                    <div className={styles.breadcrumbArea}>
                        <span className={styles.moduleBreadcrumb}>{parentInfo.moduleTitle}</span>
                        <ChevronRight size={13} className={styles.breadcrumbChevron} style={{ opacity: 0.4 }} />
                        <span className={styles.lessonBreadcrumb}>{activeLesson.title}</span>
                    </div>
                </div>

                <div className={styles.topRight}>
                    <button
                        className={`${styles.drawerToggleBtn} ${drawerOpen ? styles.drawerToggleBtnActive : ''}`}
                        onClick={() => setDrawerOpen((prev) => !prev)}
                        title="View module playlist"
                        aria-label="Module Playlist"
                    >
                        <List size={18} />
                        <span className={styles.drawerBtnText}>Playlist</span>
                        <span className={styles.playlistBadge}>{parentInfo.moduleLessons.length}</span>
                    </button>

                    <ThemeToggle />

                    {/* Desktop Complete Button */}
                    <button
                        className={`${styles.completeBtn} ${styles.topCompleteBtn} ${isCompleted ? styles.completedState : ''}`}
                        onClick={onMarkComplete}
                        disabled={markingComplete}
                        title={isCompleted ? "Lesson Completed" : "Mark Lesson as Complete"}
                    >
                        {isCompleted ? <CheckCheck size={16} /> : <Check size={16} />}
                        <span>
                            {markingComplete
                                ? "Saving..."
                                : isCompleted
                                ? "Completed"
                                : "Mark Complete"}
                        </span>
                    </button>
                </div>
            </header>

            {/* Main Content Stage */}
            <main className={`${styles.stage} ${drawerOpen ? styles.stageWithDrawer : ''}`}>
                {progressError && (
                    <div className={styles.errorBanner}>
                        {progressError}
                    </div>
                )}

                <div className={styles.playerWrapper}>
                    <LessonPlayer
                        key={activeLesson.id}
                        lesson={activeLesson as any}
                        nextLesson={() => {
                            if (nextLesson) onSelectLesson(nextLesson);
                        }}
                        onComplete={onMarkComplete}
                    />
                </div>

                {/* Lesson Details Card */}
                <div className={styles.lessonInfoCard}>
                    <div className={styles.lessonHeaderRow}>
                        <div>
                            <h2 className={styles.lessonTitle}>{activeLesson.title}</h2>
                            <div className={styles.lessonMetaRow}>
                                <span>{parentInfo.moduleTitle}</span>
                                {activeLesson.duration && (
                                    <>
                                        <span>•</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} />
                                            {activeLesson.duration}
                                        </span>
                                    </>
                                )}
                                <span>•</span>
                                <span>
                                    {activeLesson.type === 'quiz'
                                        ? 'Quiz Assessment'
                                        : activeLesson.type === 'document'
                                        ? 'Document / Reading'
                                        : 'Video Lesson'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Bottom Linear Navigation Bar */}
            <footer className={`${styles.bottomNav} ${drawerOpen ? styles.bottomNavWithDrawer : ''}`}>
                <button
                    className={styles.navActionBtn}
                    disabled={!previousLesson}
                    onClick={() => previousLesson && onSelectLesson(previousLesson)}
                >
                    <ArrowLeft size={16} />
                    <span className={styles.navBtnTextDesktop}>Previous</span>
                    <span className={styles.navBtnTextMobile}>Prev</span>
                </button>

                {/* Mobile / Center Complete Button */}
                <button
                    className={`${styles.completeBtn} ${styles.bottomCompleteBtn} ${isCompleted ? styles.completedState : ''}`}
                    onClick={onMarkComplete}
                    disabled={markingComplete}
                    title={isCompleted ? "Lesson Completed" : "Mark Lesson as Complete"}
                >
                    {isCompleted ? <CheckCheck size={16} /> : <Check size={16} />}
                    <span>
                        {markingComplete
                            ? "Saving..."
                            : isCompleted
                            ? "Completed"
                            : "Complete"}
                    </span>
                </button>

                <div className={styles.navCenterInfo}>
                    {moduleIndex >= 0 && (
                        <span>
                            Lesson {moduleIndex + 1} of {parentInfo.moduleLessons.length}
                        </span>
                    )}
                </div>

                {nextLesson ? (
                    <button
                        className={`${styles.navActionBtn} ${styles.navActionBtnPrimary}`}
                        onClick={() => onSelectLesson(nextLesson)}
                    >
                        <span>Next</span>
                        <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        className={`${styles.navActionBtn} ${styles.navActionBtnPrimary}`}
                        onClick={onBackToOutline}
                    >
                        <span>Outline</span>
                        <ChevronRight size={16} />
                    </button>
                )}
            </footer>

            {/* Slide-out Module Playlist Drawer */}
            {drawerOpen && (
                <>
                    <div
                        className={styles.playlistBackdrop}
                        onClick={() => setDrawerOpen(false)}
                    />
                    <aside className={styles.drawer}>
                        <div className={styles.drawerHeader}>
                            <h3 className={styles.drawerTitle}>{parentInfo.moduleTitle}</h3>
                            <button
                                className={styles.drawerCloseBtn}
                                onClick={() => setDrawerOpen(false)}
                                aria-label="Close playlist drawer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.drawerList}>
                            {parentInfo.moduleLessons.map((item, idx) => {
                                const isActive = item.id === activeLesson.id;
                                const isDone = completedSet.has(item.id);

                                return (
                                    <button
                                        key={item.id}
                                        className={`${styles.drawerItem} ${isActive ? styles.drawerItemActive : ''} ${item.locked ? styles.drawerItemLocked : ''}`}
                                        disabled={item.locked}
                                        onClick={() => {
                                            onSelectLesson(item);
                                            setDrawerOpen(false);
                                        }}
                                    >
                                        <div className={styles.drawerItemLeft}>
                                            {item.locked ? (
                                                <Lock size={14} style={{ color: '#f59e0b' }} />
                                            ) : (
                                                getLessonIcon(item.type)
                                            )}
                                            <span className={styles.drawerItemTitle}>
                                                {idx + 1}. {item.title}
                                            </span>
                                        </div>

                                        {isDone && (
                                            <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </>
            )}
        </div>
    );
}
