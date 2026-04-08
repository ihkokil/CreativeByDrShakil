import { motion, Variants } from "framer-motion";
import { 
    Trophy, 
    BookOpen, 
    TrendingUp, 
    Clock, 
    ArrowRight,
    PlayCircle,
    Calendar,
    Target
} from "lucide-react";
import styles from "@/components/Teacher/TeacherOverview.module.css";
import Link from "next/link";
import Image from "next/image";

interface StudentOverviewProps {
    courseCount: number;
    completionPercent: number;
    certificatesCount: number;
    studyHours: string;
    onTabChange: (tab: string) => void;
}

export default function StudentOverview({
    courseCount,
    completionPercent,
    certificatesCount,
    studyHours,
    onTabChange
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
            {/* Main Learning Card */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={cardVariants}>
                <div className={styles.heroHeader}>
                    <div>
                        <span className={styles.label}>Continue Learning</span>
                        <h2 className={styles.amount} style={{ fontSize: '2.2rem', marginTop: '4px' }}>Mastering BCPS</h2>
                    </div>
                    <div className={styles.heroAction}>
                        <PlayCircle size={20} />
                    </div>
                </div>
                
                <div className={styles.progressContainer}>
                    <div className={styles.progressLabel}>
                        <span>Overall Progress</span>
                        <span>{completionPercent}%</span>
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
                    <div className={styles.lessonInfo}>
                        <span className={styles.tag}>Next: Lesson 14</span>
                        <p>High-yield Pediatric Emergencies</p>
                    </div>
                    <Link href="/study" className={styles.viewAllBtn} style={{ width: 'auto', marginTop: 0 }}>
                        Resume Now <ArrowRight size={16} />
                    </Link>
                </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <Trophy size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{certificatesCount}</h4>
                    <p>Certificates</p>
                </div>
            </motion.div>

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

            {/* Engagement info */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.cardHeader}>
                    <h3>Study Activity</h3>
                </div>
                <div className={styles.activityStats}>
                    <div className={styles.activityItem}>
                        <Clock size={16} />
                        <div>
                            <strong>{studyHours}</strong>
                            <span>This Week</span>
                        </div>
                    </div>
                    <div className={styles.activityItem}>
                        <TrendingUp size={16} />
                        <div>
                            <strong>85%</strong>
                            <span>Avg Score</span>
                        </div>
                    </div>
                </div>
                <button className={styles.viewAllBtn} onClick={() => onTabChange('progress')}>
                    Full Analytics <ArrowRight size={16} />
                </button>
            </motion.div>

            {/* Upcoming/Goal Card */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.goalHeader}>
                    <h3>Upcoming Goal</h3>
                    <Target size={20} className={styles.goalIcon} />
                </div>
                <div className={styles.upcomingTask}>
                    <Calendar size={16} />
                    <span>BCPS Mock Exam · Mar 15</span>
                </div>
                <div className={styles.upcomingTask}>
                    <Calendar size={16} />
                    <span>Surgery Masterquiz · Mar 28</span>
                </div>
                <button className={styles.viewAllBtn} onClick={() => onTabChange('exams')}>
                    Exam Center <ArrowRight size={16} />
                </button>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <TrendingUp size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>Top 5%</h4>
                    <p>Batch Rank</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                        <Target size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>12</h4>
                    <p>Tests Remaining</p>
                </div>
            </motion.div>
        </motion.div>
    );
}
