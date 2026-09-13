"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Play,
    PlayCircle,
    FileText,
    HelpCircle,
    CheckCircle2,
    Lock,
    Folder,
    FolderOpen,
    ChevronDown,
    Sparkles,
    Clock,
    BookOpen,
    CheckCheck,
    ListFilter,
    ChevronsUpDown,
    Download,
} from "lucide-react";
import styles from "./StudyOutlineHub.module.css";
import { CurriculumNode } from "@/components/Course/CourseCurriculum";
import { formatDisplayDate } from "@/lib/date-format";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

interface Props {
    courseTitle: string;
    curriculum: CurriculumNode[];
    completedLessonIds: string[];
    onSelectLesson: (node: CurriculumNode) => void;
    activeLessonId?: string | null;
    lastVisitedLessonId?: string | null;
    courseSlug: string;
}

type FilterType = 'all' | 'video' | 'document' | 'quiz';

interface FlattenedLesson {
    node: CurriculumNode;
    moduleTitle: string;
    moduleId: string;
}

function collectAllLessons(nodes: CurriculumNode[], parentTitle = "General", parentId = "root"): FlattenedLesson[] {
    const list: FlattenedLesson[] = [];
    nodes.forEach((n) => {
        if (n.type === "folder") {
            if (n.children?.length) {
                list.push(...collectAllLessons(n.children, n.title, n.id));
            }
        } else {
            list.push({ node: n, moduleTitle: parentTitle, moduleId: parentId });
        }
    });
    return list;
}

function getLessonType(node: CurriculumNode): 'video' | 'document' | 'quiz' {
    if (node.type === 'quiz' || Boolean(node.quizId)) return 'quiz';
    if (node.type === 'document') return 'document';
    const lowerUrl = (node.url || '').toLowerCase();
    const docExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.zip'];
    if (docExtensions.some(ext => lowerUrl.includes(ext))) return 'document';
    return 'video';
}

function countModuleBreakdown(node: CurriculumNode): {
    total: number;
    videos: number;
    docs: number;
    quizzes: number;
    items: CurriculumNode[];
} {
    let videos = 0;
    let docs = 0;
    let quizzes = 0;
    const items: CurriculumNode[] = [];

    const walk = (n: CurriculumNode) => {
        if (n.type === 'folder') {
            n.children?.forEach(walk);
        } else {
            items.push(n);
            const t = getLessonType(n);
            if (t === 'quiz') quizzes++;
            else if (t === 'document') docs++;
            else videos++;
        }
    };

    walk(node);
    return { total: items.length, videos, docs, quizzes, items };
}

export default function StudyOutlineHub({
    courseTitle,
    curriculum,
    completedLessonIds,
    onSelectLesson,
    activeLessonId,
    lastVisitedLessonId,
    courseSlug,
}: Props) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());

    const completedSet = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

    // Group curriculum into top-level modules
    const modules = useMemo(() => {
        const topModules: Array<{
            id: string;
            title: string;
            locked: boolean;
            availableAt?: string | null;
            breakdown: ReturnType<typeof countModuleBreakdown>;
            rawNode: CurriculumNode;
        }> = [];

        curriculum.forEach((node, index) => {
            if (node.type === 'folder') {
                topModules.push({
                    id: node.id || `module-${index}`,
                    title: node.title,
                    locked: Boolean(node.locked),
                    availableAt: node.availableAt,
                    breakdown: countModuleBreakdown(node),
                    rawNode: node,
                });
            } else {
                // If there are top-level loose items without a folder, wrap into a default module
                let rootModule = topModules.find((m) => m.id === 'root-overview');
                if (!rootModule) {
                    const syntheticNode: CurriculumNode = {
                        id: 'root-overview',
                        title: 'Course Materials & Overview',
                        type: 'folder',
                        children: [],
                    };
                    rootModule = {
                        id: 'root-overview',
                        title: 'Course Materials & Overview',
                        locked: false,
                        breakdown: { total: 0, videos: 0, docs: 0, quizzes: 0, items: [] },
                        rawNode: syntheticNode,
                    };
                    topModules.unshift(rootModule);
                }
                rootModule.rawNode.children?.push(node);
                rootModule.breakdown = countModuleBreakdown(rootModule.rawNode);
            }
        });

        return topModules;
    }, [curriculum]);

    // Flatten all playable lessons across the course
    const allLessons = useMemo(() => collectAllLessons(curriculum), [curriculum]);
    const totalPlayableCount = allLessons.length;
    const completedCount = allLessons.filter(l => completedSet.has(l.node.id)).length;
    const overallPercentage = totalPlayableCount > 0 ? Math.round((completedCount / totalPlayableCount) * 100) : 0;

    // Filter counts across course
    const filterCounts = useMemo(() => {
        let videos = 0;
        let docs = 0;
        let quizzes = 0;
        allLessons.forEach(l => {
            const t = getLessonType(l.node);
            if (t === 'video') videos++;
            else if (t === 'document') docs++;
            else if (t === 'quiz') quizzes++;
        });
        return { all: totalPlayableCount, video: videos, document: docs, quiz: quizzes };
    }, [allLessons, totalPlayableCount]);

    // Identify next lesson to resume based on last visited or first incomplete
    const resumeLesson = useMemo(() => {
        const unlockedLessons = allLessons.filter(l => !l.node.locked);
        if (unlockedLessons.length === 0) return null;

        // 1. If user recently watched/visited a lesson, find and resume it
        if (lastVisitedLessonId) {
            const lastVisited = unlockedLessons.find(l => l.node.id === lastVisitedLessonId);
            if (lastVisited) {
                // If it's not completed, resume this exact lesson!
                if (!completedSet.has(lastVisited.node.id)) {
                    return lastVisited;
                }
                // If it was completed, suggest the next lesson right after it
                const idx = unlockedLessons.findIndex(l => l.node.id === lastVisited.node.id);
                if (idx >= 0 && idx < unlockedLessons.length - 1) {
                    return unlockedLessons[idx + 1];
                }
                return lastVisited;
            }
        }

        // 2. Otherwise fallback to first incomplete playable lesson
        const firstIncomplete = unlockedLessons.find(l => !completedSet.has(l.node.id));
        return firstIncomplete || unlockedLessons[0] || null;
    }, [allLessons, completedSet, lastVisitedLessonId]);

    // When resumeLesson is determined, auto-expand its parent module
    useEffect(() => {
        if (resumeLesson?.moduleId) {
            setExpandedModuleIds(prev => {
                const next = new Set(prev);
                next.add(resumeLesson.moduleId);
                return next;
            });
        }
    }, [resumeLesson?.moduleId]);

    // Toggle single module accordion
    const toggleModule = (id: string, isLocked: boolean) => {
        if (isLocked) return;
        setExpandedModuleIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Toggle all accordions
    const toggleAll = () => {
        if (expandedModuleIds.size > 0) {
            setExpandedModuleIds(new Set());
        } else {
            const unlockedIds = modules.filter(m => !m.locked).map(m => m.id);
            setExpandedModuleIds(new Set(unlockedIds));
        }
    };

    return (
        <div className={styles.container}>
            {/* Top Navigation */}
            <header className={styles.topNav}>
                <Link href="/dashboard/courses" className={styles.backBtn}>
                    <ArrowLeft size={16} />
                    <span>My Courses</span>
                </Link>

                <div className={styles.topNavActions}>
                    <ThemeToggle />
                </div>
            </header>

            {/* Course Header Banner */}
            <section className={styles.courseHeaderCard}>
                <div className={styles.courseTitleRow}>
                    <div>
                        <span className={styles.courseBadge}>
                            <BookOpen size={13} />
                            Course Curriculum
                        </span>
                        <h1 className={styles.courseTitle}>{courseTitle}</h1>

                        <div className={styles.statsOverview}>
                            <span className={styles.statItem}>
                                <BookOpen size={14} />
                                {modules.length} {modules.length === 1 ? 'Module' : 'Modules'}
                            </span>
                            <span className={styles.statDot}>•</span>
                            <span className={styles.statItem}>
                                <PlayCircle size={14} />
                                {filterCounts.video} Videos
                            </span>
                            {filterCounts.document > 0 && (
                                <>
                                    <span className={styles.statDot}>•</span>
                                    <span className={styles.statItem}>
                                        <FileText size={14} />
                                        {filterCounts.document} Documents
                                    </span>
                                </>
                            )}
                            {filterCounts.quiz > 0 && (
                                <>
                                    <span className={styles.statDot}>•</span>
                                    <span className={styles.statItem}>
                                        <HelpCircle size={14} />
                                        {filterCounts.quiz} Quizzes
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className={styles.progressContainer}>
                    <div className={styles.progressLabelRow}>
                        <span>Overall Progress ({completedCount}/{totalPlayableCount} completed)</span>
                        <span className={styles.progressPct}>{overallPercentage}%</span>
                    </div>
                    <div className={styles.progressBarTrack}>
                        <div
                            className={styles.progressBarFill}
                            style={{ width: `${overallPercentage}%` }}
                        />
                    </div>
                </div>
            </section>

            {/* Quick Resume Hero Card */}
            {resumeLesson && (
                <div className={styles.resumeCard}>
                    <div className={styles.resumeInfo}>
                        <span className={styles.resumeBadge}>
                            <Sparkles size={13} />
                            {completedCount === totalPlayableCount ? 'Course Completed' : 'Pick Up Where You Left Off'}
                        </span>
                        <h3 className={styles.resumeLessonTitle}>
                            {resumeLesson.node.title}
                        </h3>
                        <span className={styles.resumeMeta}>
                            {resumeLesson.moduleTitle} • {getLessonType(resumeLesson.node) === 'quiz' ? 'Quiz Assessment' : getLessonType(resumeLesson.node) === 'document' ? 'Document/Slide' : 'Video Lesson'}
                            {resumeLesson.node.duration ? ` · ${resumeLesson.node.duration}` : ''}
                        </span>
                    </div>

                    <button
                        className={styles.resumeBtn}
                        onClick={() => onSelectLesson(resumeLesson.node)}
                    >
                        {getLessonType(resumeLesson.node) === 'document' ? (
                            <>
                                <Download size={15} />
                                <span>Download Document</span>
                            </>
                        ) : getLessonType(resumeLesson.node) === 'quiz' ? (
                            <>
                                <HelpCircle size={15} />
                                <span>{completedSet.has(resumeLesson.node.id) ? 'Review Quiz' : 'Start Quiz'}</span>
                            </>
                        ) : (
                            <>
                                <Play size={15} fill="currentColor" />
                                <span>{completedSet.has(resumeLesson.node.id) ? 'Rewatch Video' : 'Continue Learning'}</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Filter Bar & Controls */}
            <div className={styles.filterBar}>
                <div className={styles.filterPills}>
                    <button
                        className={`${styles.filterPill} ${filter === 'all' ? styles.filterPillActive : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All ({filterCounts.all})
                    </button>
                    <button
                        className={`${styles.filterPill} ${filter === 'video' ? styles.filterPillActive : ''}`}
                        onClick={() => setFilter('video')}
                    >
                        <PlayCircle size={14} />
                        Videos ({filterCounts.video})
                    </button>
                    {filterCounts.document > 0 && (
                        <button
                            className={`${styles.filterPill} ${filter === 'document' ? styles.filterPillActive : ''}`}
                            onClick={() => setFilter('document')}
                        >
                            <FileText size={14} />
                            Documents ({filterCounts.document})
                        </button>
                    )}
                    {filterCounts.quiz > 0 && (
                        <button
                            className={`${styles.filterPill} ${filter === 'quiz' ? styles.filterPillActive : ''}`}
                            onClick={() => setFilter('quiz')}
                        >
                            <HelpCircle size={14} />
                            Quizzes ({filterCounts.quiz})
                        </button>
                    )}
                </div>

                <button className={styles.toggleAllBtn} onClick={toggleAll}>
                    <ChevronsUpDown size={15} />
                    <span>{expandedModuleIds.size > 0 ? 'Collapse All' : 'Expand All'}</span>
                </button>
            </div>

            {/* Collapsed by Default Accordion Modules List */}
            <div className={styles.modulesList}>
                {modules.map((mod, modIdx) => {
                    const isExpanded = expandedModuleIds.has(mod.id);
                    const moduleCompletedItems = mod.breakdown.items.filter(item => completedSet.has(item.id)).length;
                    const isModuleComplete = mod.breakdown.total > 0 && moduleCompletedItems === mod.breakdown.total;

                    // Filter items inside module if filter active
                    const displayItems = mod.breakdown.items.filter(item => {
                        if (filter === 'all') return true;
                        return getLessonType(item) === filter;
                    });

                    // If filter is active and module has no matching items, we can still show or dim it
                    if (filter !== 'all' && displayItems.length === 0) {
                        return null;
                    }

                    return (
                        <div
                            key={mod.id}
                            className={`${styles.moduleCard} ${isExpanded ? styles.moduleCardActive : ''} ${mod.locked ? styles.moduleCardLocked : ''}`}
                        >
                            <button
                                className={styles.moduleHeader}
                                onClick={() => toggleModule(mod.id, mod.locked)}
                                aria-expanded={isExpanded}
                                disabled={mod.locked}
                            >
                                <div className={styles.moduleHeaderLeft}>
                                    <div
                                        className={`${styles.folderStatusIcon} ${
                                            isModuleComplete
                                                ? styles.folderStatusDone
                                                : mod.locked
                                                ? styles.folderStatusLocked
                                                : ''
                                        }`}
                                    >
                                        {mod.locked ? (
                                            <Lock size={18} />
                                        ) : isModuleComplete ? (
                                            <CheckCheck size={18} />
                                        ) : isExpanded ? (
                                            <FolderOpen size={18} />
                                        ) : (
                                            <Folder size={18} />
                                        )}
                                    </div>

                                    <div className={styles.moduleHeaderText}>
                                        <h3 className={styles.moduleTitle}>
                                            {mod.title}
                                        </h3>
                                        <div className={styles.moduleSubtitle}>
                                            {mod.breakdown.videos > 0 && <span>{mod.breakdown.videos} Videos</span>}
                                            {mod.breakdown.docs > 0 && <span>• {mod.breakdown.docs} Documents</span>}
                                            {mod.breakdown.quizzes > 0 && <span>• {mod.breakdown.quizzes} Quizzes</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.moduleHeaderRight}>
                                    {mod.locked ? (
                                        <span className={styles.moduleBadgeLocked}>
                                            <Lock size={12} />
                                            {mod.availableAt ? `Available ${formatDisplayDate(mod.availableAt)}` : 'Locked'}
                                        </span>
                                    ) : isModuleComplete ? (
                                        <span className={styles.moduleBadgeCompleted}>
                                            <CheckCircle2 size={13} />
                                            Completed
                                        </span>
                                    ) : (
                                        <span className={styles.moduleBadgeProgress}>
                                            {moduleCompletedItems}/{mod.breakdown.total} Done
                                        </span>
                                    )}

                                    {!mod.locked && (
                                        <ChevronDown
                                            size={18}
                                            className={`${styles.chevronIcon} ${isExpanded ? styles.chevronRotated : ''}`}
                                        />
                                    )}
                                </div>
                            </button>

                            {/* Accordion Content */}
                            <AnimatePresence initial={false}>
                                {isExpanded && !mod.locked && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.22, ease: "easeInOut" }}
                                    >
                                        <div className={styles.moduleLessonsBody}>
                                            {displayItems.length === 0 ? (
                                                <div className={styles.emptyState}>
                                                    No items matching the selected filter in this module.
                                                </div>
                                            ) : (
                                                displayItems.map((item) => {
                                                    const itemType = getLessonType(item);
                                                    const isDone = completedSet.has(item.id);
                                                    const isActive = item.id === activeLessonId;

                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`${styles.lessonRow} ${isActive ? styles.lessonRowActive : ''} ${item.locked ? styles.lessonRowLocked : ''}`}
                                                        >
                                                            <div className={styles.lessonRowLeft}>
                                                                <div
                                                                    className={`${styles.lessonTypeIcon} ${
                                                                        itemType === 'quiz'
                                                                            ? styles.lessonTypeIconQuiz
                                                                            : itemType === 'document'
                                                                            ? styles.lessonTypeIconDoc
                                                                            : styles.lessonTypeIconPlay
                                                                    }`}
                                                                >
                                                                    {itemType === 'quiz' ? (
                                                                        <HelpCircle size={15} />
                                                                    ) : itemType === 'document' ? (
                                                                        <FileText size={15} />
                                                                    ) : (
                                                                        <PlayCircle size={15} />
                                                                    )}
                                                                </div>

                                                                <div className={styles.lessonTitleMeta}>
                                                                    <span className={styles.lessonTitleText}>
                                                                        {item.title}
                                                                    </span>
                                                                    <div className={styles.lessonSubMeta}>
                                                                        <span>
                                                                            {itemType === 'quiz'
                                                                                ? 'Quiz'
                                                                                : itemType === 'document'
                                                                                ? 'Document'
                                                                                : 'Video'}
                                                                        </span>
                                                                        {item.duration && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span>{item.duration}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className={styles.lessonRowRight}>
                                                                {isDone && (
                                                                    <CheckCircle2 size={18} className={styles.completedCheck} />
                                                                )}

                                                                <button
                                                                    className={`${styles.playLessonBtn} ${isActive ? styles.playLessonBtnActive : ''}`}
                                                                    disabled={item.locked}
                                                                    onClick={() => onSelectLesson(item)}
                                                                >
                                                                    {itemType === 'document' ? (
                                                                        <>
                                                                            <Download size={13} />
                                                                            <span>Download</span>
                                                                        </>
                                                                    ) : itemType === 'quiz' ? (
                                                                        <>
                                                                            <HelpCircle size={13} />
                                                                            <span>{isDone ? 'Review' : 'Start'}</span>
                                                                        </>
                                                                    ) : isDone ? (
                                                                        <>
                                                                            <Play size={13} fill="currentColor" />
                                                                            <span>Rewatch</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Play size={13} fill="currentColor" />
                                                                            <span>Start</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
