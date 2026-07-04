"use client";

import { motion } from "framer-motion";
import { 
    BookOpen, 
    Play, 
    Plus,
    Video,
    ArrowUpRight,
    LayoutDashboard,
    Users,
    CheckCircle
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
    onTabChange
}: TeacherOverviewProps) {
    const router = useRouter();

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    };

    return (
        <motion.div 
            className={styles.bentoGrid}
            variants={container}
            initial="hidden"
            animate="show"
        >
            {/* 1. Welcome Hero */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={item}>
                <div className={styles.heroHeader}>
                    <div>
                        <span className={styles.label}>Instructor Hub</span>
                        <h2 className={styles.amount} style={{ fontSize: '2.5rem', marginTop: '8px' }}>
                            Welcome back, <span className="gradient-text">{teacherName.split(' ')[0]}</span>
                        </h2>
                        <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                            Manage your medical programs and monitor student success.
                        </p>
                    </div>
                </div>
                
                <div className={styles.nextLesson}>
                    <button onClick={() => router.push('/teacher/dashboard/courses/create')} className={styles.viewAllBtn} style={{ width: 'auto', marginTop: 0 }}>
                        <Plus size={18} /> Create New Course
                    </button>
                </div>
            </motion.div>

            {/* 2. Key Metrics */}
            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={item}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <BookOpen size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{totalCourses}</h4>
                    <p>Total Programs</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={item}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <Users size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{totalStudents}</h4>
                    <p>Total Students</p>
                </div>
            </motion.div>

            {/* 3. Quick Actions */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={item}>
                <div className={styles.cardHeader}>
                    <h3>Quick Management</h3>
                </div>
                <div className={styles.actionGrid}>
                    <button onClick={() => onTabChange("library")} className={styles.actionBtn}>
                        <div className={styles.actionIcon}><Video size={18} /></div>
                        <div className={styles.actionInfo}>
                            <strong>Media Vault</strong>
                            <span>Manage video lectures</span>
                        </div>
                    </button>
                    <button onClick={() => onTabChange("courses")} className={styles.actionBtn}>
                        <div className={styles.actionIcon}><BookOpen size={18} /></div>
                        <div className={styles.actionInfo}>
                            <strong>Course Manager</strong>
                            <span>Curriculum & pricing</span>
                        </div>
                    </button>
                </div>
                <button 
                    className={styles.viewAllBtn} 
                    style={{ marginTop: '20px' }}
                    onClick={() => router.push('/courses')}
                >
                    View Student Site <ArrowUpRight size={14} />
                </button>
            </motion.div>

            {/* 4. Course Progress / Performance */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={item}>
                <div className={styles.cardHeader}>
                    <h3>Program Performance</h3>
                    <span className={styles.statusPill}>Avg. {aggregateProgress}% Student Completion</span>
                </div>
                <div className={styles.activities}>
                    {courseProgress.length > 0 ? (
                        courseProgress.slice(0, 3).map((cp) => (
                            <div key={cp.courseId} className={styles.activityItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>{cp.courseTitle}</strong>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cp.enrollmentCount} students</span>
                                </div>
                                <div className={styles.progressContainer} style={{ margin: '4px 0 0' }}>
                                    <div className={styles.progressLabel}>
                                        <span style={{ fontSize: '0.7rem' }}>Avg. Student Progress</span>
                                        <span style={{ fontSize: '0.7rem' }}>{cp.avgProgress}%</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill} style={{ width: `${cp.avgProgress}%` }} />
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.infoBox} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                            No courses available for analytics yet.
                        </div>
                    )}
                </div>
                {courseProgress.length > 3 && (
                    <button className={styles.viewAllBtn} onClick={() => onTabChange("courses")}>
                        View All Programs <ArrowUpRight size={14} />
                    </button>
                )}
            </motion.div>


        </motion.div>
    );
}
