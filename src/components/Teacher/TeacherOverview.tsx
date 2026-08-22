"use client";

import { motion } from "framer-motion";
import { 
    BookOpen, 
    Plus, 
    Video, 
    ArrowUpRight, 
    Users, 
    CheckCircle, 
    Sparkles, 
    Layers, 
    FileQuestion 
} from "lucide-react";
import styles from "./TeacherOverview.module.css";
import { useRouter } from "next/navigation";

interface CourseProgress {
    courseId: string;
    courseTitle: string;
    enrollmentCount: number;
    avgProgress: number;
}

interface TeacherOverviewProps {
    totalCourses: number;
    totalStudents: number;
    totalEnrollments: number;

    courseProgress: CourseProgress[];
    aggregateProgress: number;
    teacherName: string;
    onTabChange: (tab: string) => void;
}

export default function TeacherOverview({
    totalCourses,
    totalStudents,
    totalEnrollments,

    courseProgress,
    aggregateProgress,
    teacherName,
    onTabChange,
}: TeacherOverviewProps) {
    const router = useRouter();

    return (
        <div className={styles.dashboardOverview}>
            {/* 1. Hero Welcome Banner */}
            <div className={styles.welcomeHero}>
                <div className={styles.welcomeInfo}>
                    <div className={styles.welcomeKicker}>
                        <Sparkles size={14} />
                        <span>Instructor Workspace</span>
                    </div>
                    <h1 className={styles.welcomeTitle}>
                        Welcome back, <span className="gradient-text">{teacherName.split(' ')[0]}</span>
                    </h1>
                    <p className={styles.welcomeSubtitle}>
                        Manage your medical courses, organize student cohorts, and track live progress across your academy.
                    </p>
                </div>
                <div className={styles.welcomeActions}>
                    <button onClick={() => router.push('/teacher/dashboard/courses/create')} className={styles.primaryActionBtn}>
                        <Plus size={18} /> Create New Course
                    </button>
                    <button onClick={() => router.push('/teacher/dashboard/batches')} className={styles.secondaryActionBtn}>
                        <Layers size={18} /> Manage Batches
                    </button>
                </div>
            </div>

            {/* 2. 4-Card KPI Metric Strip */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.blueIcon}`}>
                            <BookOpen size={22} />
                        </div>
                        <span className={styles.metricBadge}>Programs</span>
                    </div>
                    <div className={styles.metricValue}>{totalCourses}</div>
                    <div className={styles.metricLabel}>Total Published Courses</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.purpleIcon}`}>
                            <Users size={22} />
                        </div>
                        <span className={styles.metricBadge}>Learners</span>
                    </div>
                    <div className={styles.metricValue}>{totalStudents}</div>
                    <div className={styles.metricLabel}>Total Enrolled Students</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.emeraldIcon}`}>
                            <CheckCircle size={22} />
                        </div>
                        <span className={styles.metricBadge}>Completion</span>
                    </div>
                    <div className={styles.metricValue}>{aggregateProgress}%</div>
                    <div className={styles.metricLabel}>Average Student Progress</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.amberIcon}`}>
                            <Video size={22} />
                        </div>
                        <span className={styles.metricBadge}>Content</span>
                    </div>
                    <div className={styles.metricValue}>{totalEnrollments}</div>
                    <div className={styles.metricLabel}>Total Active Enrollments</div>
                </div>
            </div>

            {/* 3. 2-Column Split: Analytics & Quick Management */}
            <div className={styles.contentSplit}>
                {/* Left: Program Performance */}
                <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                        <div>
                            <h3 className={styles.panelCardTitle}>Course Performance & Analytics</h3>
                            <p className={styles.panelCardSubtitle}>Track learner progression and engagement across active cohorts</p>
                        </div>
                        <button className={styles.panelHeaderLink} onClick={() => onTabChange("courses")}>
                            All Courses <ArrowUpRight size={15} />
                        </button>
                    </div>
                    <div className={styles.courseProgressList}>
                        {courseProgress.length > 0 ? (
                            courseProgress.slice(0, 4).map((cp) => (
                                <div key={cp.courseId} className={styles.courseProgressItem}>
                                    <div className={styles.courseProgressTop}>
                                        <strong className={styles.courseName}>{cp.courseTitle}</strong>
                                        <span className={styles.courseStudents}>{cp.enrollmentCount} students</span>
                                    </div>
                                    <div className={styles.progressBarWrapper}>
                                        <div className={styles.progressBarTrack}>
                                            <div className={styles.progressBarFill} style={{ width: `${cp.avgProgress}%` }} />
                                        </div>
                                        <span className={styles.progressPercent}>{cp.avgProgress}%</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className={styles.emptyAnalytics}>
                                <BookOpen size={36} className={styles.emptyIcon} />
                                <p>No active courses available for performance tracking yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Quick Management Tools */}
                <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                        <div>
                            <h3 className={styles.panelCardTitle}>Quick Management</h3>
                            <p className={styles.panelCardSubtitle}>Frequent instructor shortcuts and tools</p>
                        </div>
                    </div>
                    <div className={styles.quickToolsGrid}>
                        <button onClick={() => onTabChange("library")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.blueIcon}`}>
                                <Video size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Master Module Library</strong>
                                <span>Manage videos, PDFs, and resources</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("batches")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.purpleIcon}`}>
                                <Layers size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Cohort & Batches</strong>
                                <span>Configure schedules & access rules</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("quizzes")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.amberIcon}`}>
                                <FileQuestion size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Quiz Management</strong>
                                <span>Build assessments & view results</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("students")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.emeraldIcon}`}>
                                <Users size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Student Directory</strong>
                                <span>Search learners & manage enrollments</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
