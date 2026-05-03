"use client";

import { motion, Variants } from "framer-motion";
import { 
    Users, 
    BookOpen, 
    TrendingUp, 
    UserPlus, 
    ArrowRight,
    Search,
    MonitorIcon,
    SmartphoneIcon,
    LayoutGrid,
    Inbox,
    ShieldCheck,
    Briefcase,
    CreditCard
} from "lucide-react";
import styles from "@/components/Teacher/TeacherOverview.module.css";

interface AdminOverviewProps {
    teacherCount: number;
    studentCount: number;
    courseCount: number;
    totalEnrollments: number;
    totalLessonsCompleted: number;
    onTabChange: (tab: string) => void;
}

export default function AdminOverview({
    teacherCount,
    studentCount,
    courseCount,
    totalEnrollments,
    totalLessonsCompleted,
    onTabChange
}: AdminOverviewProps) {
    
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
            {/* 1. Platform Summary Hero */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={cardVariants}>
                <div className={styles.heroHeader}>
                    <div>
                        <span className={styles.label}>Platform Command Center</span>
                        <div className={styles.revenueDisplay}>
                            <span className={styles.amount}>{studentCount + teacherCount}</span>
                            <span className={styles.currency} style={{marginLeft: '10px', alignSelf: 'flex-end', paddingBottom: '10px'}}>Active Students</span>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginTop: '-8px' }}>
                            Real-time participation and growth metrics across the platform.
                        </p>
                    </div>
                </div>
                
                <div className={styles.nextLesson}>
                    <div className={styles.lessonInfo}>
                        <span className={styles.tag}>Live Snapshots</span>
                        <p>{totalEnrollments} Successive Enrollments</p>
                    </div>
                </div>
            </motion.div>

            {/* 2. Primary Metrics */}
            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <Briefcase size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{teacherCount}</h4>
                    <p>Instructors</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <Users size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{studentCount}</h4>
                    <p>Registered Students</p>
                </div>
            </motion.div>

            {/* 3. Governance Grid */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.cardHeader}>
                    <h3>Governance Controls</h3>
                </div>
                <div className={styles.actionGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <button className={styles.actionBtn} onClick={() => onTabChange('teachers')} style={{ padding: '12px' }}>
                        <div className={styles.actionIcon}><UserPlus size={18} /></div>
                        <span style={{ fontSize: '0.85rem' }}>Teachers</span>
                    </button>
                    <button className={styles.actionBtn} onClick={() => onTabChange('students')} style={{ padding: '12px' }}>
                        <div className={styles.actionIcon}><Users size={18} /></div>
                        <span style={{ fontSize: '0.85rem' }}>Students</span>
                    </button>
                    <button className={styles.actionBtn} onClick={() => onTabChange('sessions')} style={{ padding: '12px' }}>
                        <div className={styles.actionIcon}><MonitorIcon size={18} /></div>
                        <span style={{ fontSize: '0.85rem' }}>Sessions</span>
                    </button>
                    <button className={styles.actionBtn} onClick={() => onTabChange('payments')} style={{ padding: '12px' }}>
                        <div className={styles.actionIcon}><CreditCard size={18} /></div>
                        <span style={{ fontSize: '0.85rem' }}>Payments</span>
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                    <button className={styles.viewAllBtn} onClick={() => onTabChange('categories')} style={{ flex: 1 }}>
                        <LayoutGrid size={14} /> Global Taxonomy
                    </button>
                    <button className={styles.viewAllBtn} onClick={() => onTabChange('support')} style={{ flex: 1 }}>
                        <Inbox size={14} /> Help Inbound
                    </button>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <BookOpen size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{courseCount}</h4>
                    <p>Published Courses</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <ShieldCheck size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{totalLessonsCompleted}</h4>
                    <p>Lessons Served</p>
                </div>
            </motion.div>
        </motion.div>
    );
}
