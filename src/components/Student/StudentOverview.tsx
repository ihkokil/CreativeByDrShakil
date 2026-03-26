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
            <motion.div className={`${styles.bentoCard} ${styles.large}`} variants={cardVariants}>
                <div className={styles.revenueHeader}>
                    <div>
                        <span className={styles.label}>Continue Learning</span>
                        <h2 className={styles.revenueAmount}>Mastering BCPS Surgery</h2>
                    </div>
                    <div className={styles.trendUp}>
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
                    <Link href="/study" className={styles.cardAction}>
                        Resume Now <ArrowRight size={16} />
                    </Link>
                </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <Trophy size={20} />
                </div>
                <h3 className={styles.metricValue}>{certificatesCount}</h3>
                <p className={styles.metricLabel}>Certificates</p>
            </motion.div>

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <BookOpen size={20} />
                </div>
                <h3 className={styles.metricValue}>{courseCount}</h3>
                <p className={styles.metricLabel}>My Courses</p>
            </motion.div>

            {/* Engagement info */}
            <motion.div className={`${styles.bentoCard} ${styles.medium}`} variants={cardVariants}>
                <h3 className={styles.cardTitle}>Study Activity</h3>
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
                <button className={styles.cardAction} onClick={() => onTabChange('progress')}>
                    Full Analytics <ArrowRight size={16} />
                </button>
            </motion.div>

            {/* Upcoming/Goal Card */}
            <motion.div className={`${styles.bentoCard} ${styles.medium}`} variants={cardVariants}>
                <div className={styles.goalHeader}>
                    <h3 className={styles.cardTitle}>Upcoming Goal</h3>
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
                <button className={styles.cardAction} onClick={() => onTabChange('exams')}>
                    Exam Center <ArrowRight size={16} />
                </button>
            </motion.div>

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <TrendingUp size={20} />
                </div>
                <h3 className={styles.metricValue}>Top 5%</h3>
                <p className={styles.metricLabel}>Batch Rank</p>
            </motion.div>

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                    <Target size={20} />
                </div>
                <h3 className={styles.metricValue}>12</h3>
                <p className={styles.metricLabel}>Tests Remaining</p>
            </motion.div>
        </motion.div>
    );
}
