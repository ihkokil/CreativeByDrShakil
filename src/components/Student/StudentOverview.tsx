"use client";

import { motion, Variants } from "framer-motion";
import { 
    BookOpen, 
    ArrowRight,
    PlayCircle,
    UserCog,
    CheckCircle
} from "lucide-react";
import Link from "next/link";
import styles from "@/components/Teacher/TeacherOverview.module.css";

interface EnrolledCourse {
    orderId: string;
    courseId: string;
    courseSlug: string | null;
    courseTitle: string;
    progress: {
        percentage: number;
    };
}

interface StudentOverviewProps {
    courseCount: number;
    completionPercent: number;
    completedLessons: number;
    enrolledCourses: EnrolledCourse[];
    onTabChange: (tab: string) => void;
}

export default function StudentOverview({
    courseCount,
    completionPercent,
    completedLessons,
    enrolledCourses,
    onTabChange,
}: StudentOverviewProps) {
    
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const cardVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                duration: 0.5,
                ease: "easeOut"
            }
        }
    };

    return (
        <motion.div 
            className={styles.bentoGrid}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* 1. Progress Hero Card */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={cardVariants}>
                <div className={styles.heroHeader}>
                    <div>
                        <span className={styles.label}>Study Workspace</span>
                        <h2 className={styles.amount} style={{ fontSize: '2.5rem', marginTop: '8px' }}>
                            Your <span className="gradient-text">Learning Journey</span>
                        </h2>
                    </div>
                </div>
                
                <div className={styles.progressContainer}>
                    <div className={styles.progressLabel}>
                        <span style={{ fontSize: '0.9rem' }}>Average Completion</span>
                        <span style={{ fontSize: '0.9rem' }}>{completionPercent}%</span>
                    </div>
                    <div className={styles.progressBar}>
                        <motion.div 
                            className={styles.progressFill}
                            initial={{ width: 0 }}
                            animate={{ width: `${completionPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                        />
                    </div>
                </div>

                <div className={styles.nextLesson}>
                    <button onClick={() => onTabChange("courses")} className={styles.viewAllBtn} style={{ width: 'auto', marginTop: 0 }}>
                        <PlayCircle size={18} /> Continue Studying
                    </button>
                </div>
            </motion.div>

            {/* 2. Key Metrics */}
            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <BookOpen size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{courseCount}</h4>
                    <p>My Courses</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <CheckCircle size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{completedLessons}</h4>
                    <p>Lessons Completed</p>
                </div>
            </motion.div>

            {/* 3. Course Progress List */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.cardHeader}>
                    <h3>Recent Courses</h3>
                </div>
                <div className={styles.activities}>
                    {enrolledCourses.length > 0 ? (
                        enrolledCourses.slice(0, 3).map((course) => (
                            <div key={course.courseId} className={styles.activityItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>{course.courseTitle}</strong>
                                </div>
                                <div className={styles.progressContainer} style={{ margin: '4px 0 0' }}>
                                    <div className={styles.progressLabel}>
                                        <span style={{ fontSize: '0.7rem' }}>Progress</span>
                                        <span style={{ fontSize: '0.7rem' }}>{course.progress.percentage}%</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${course.progress.percentage}%` }} />
                                    </div>
                                </div>
                                {course.courseSlug && (
                                    <Link href={`/study/${course.courseSlug}`} style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        Go to Classroom <ArrowRight size={12} />
                                    </Link>
                                )}
                            </div>
                        ))
                    ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>
                            You haven't enrolled in any courses yet.
                        </p>
                    )}
                </div>
                <button className={styles.viewAllBtn} onClick={() => onTabChange('courses')} style={{ marginTop: '20px' }}>
                    View All Enrollments <ArrowRight size={16} />
                </button>
            </motion.div>

            {/* 4. Quick Actions */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.cardHeader}>
                    <h3>Shortcuts</h3>
                </div>
                <div className={styles.actionGrid} style={{ gridTemplateColumns: '1fr' }}>
                    <button onClick={() => onTabChange("courses")} className={styles.actionBtn}>
                        <div className={styles.actionIcon}><BookOpen size={18} /></div>
                        <div className={styles.actionInfo}>
                            <strong>My Enrollments</strong>
                            <span>View your enrolled courses</span>
                        </div>
                    </button>
                    <button onClick={() => onTabChange("profile")} className={styles.actionBtn}>
                        <div className={styles.actionIcon}><UserCog size={18} /></div>
                        <div className={styles.actionInfo}>
                            <strong>Profile Management</strong>
                            <span>Profile & personal info</span>
                        </div>
                    </button>
                </div>
            </motion.div>

        </motion.div>
    );
}
