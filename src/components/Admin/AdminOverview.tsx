import { motion, Variants } from "framer-motion";
import { 
    Users, 
    BookOpen, 
    DollarSign, 
    TrendingUp, 
    UserPlus, 
    BarChart3, 
    Shield, 
    ArrowRight,
    Search,
    MonitorIcon,
    SmartphoneIcon
} from "lucide-react";
import styles from "@/components/Teacher/TeacherOverview.module.css";

interface AdminOverviewProps {
    teacherCount: number;
    studentCount: number;
    courseCount: number;
    onTabChange: (tab: string) => void;
}

export default function AdminOverview({
    teacherCount,
    studentCount,
    courseCount,
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
            {/* Primary Stats */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={cardVariants}>
                <div className={styles.heroHeader}>
                    <div>
                        <span className={styles.label}>Platform Analytics</span>
                        <div className={styles.revenueDisplay}>
                            <span className={styles.amount}>{studentCount + teacherCount}</span>
                            <span className={styles.currency} style={{marginLeft: '10px', alignSelf: 'flex-end', paddingBottom: '10px'}}>Total Users</span>
                        </div>
                    </div>
                    <div className={styles.heroAction}>
                        <TrendingUp size={16} />
                        <span>+12.5%</span>
                    </div>
                </div>
                <div>
                    {/* Simplified Chart representation */}
                    <div className={styles.miniChart}>
                        {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                            <motion.div 
                                key={i}
                                className={styles.bar}
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: 0.5 + (i * 0.1), duration: 0.8 }}
                            />
                        ))}
                    </div>
                </div>
                <button className={styles.viewAllBtn} onClick={() => onTabChange('analytics')} style={{ marginTop: '10px' }}>
                    Detailed Analytics <ArrowRight size={16} />
                </button>
            </motion.div>

            {/* Quick Actions */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.cardHeader}>
                    <h3>Quick Management</h3>
                </div>
                <div className={styles.actionGrid}>
                    <button className={styles.actionBtn} onClick={() => onTabChange('teachers')}>
                        <div className={styles.actionIcon}><UserPlus size={20} /></div>
                        <span>Invite Teacher</span>
                    </button>
                    <button className={styles.actionBtn} onClick={() => onTabChange('coupons')}>
                        <div className={styles.actionIcon}><TrendingUp size={20} /></div>
                        <span>New Offer</span>
                    </button>
                    <button className={styles.actionBtn} onClick={() => onTabChange('sessions')}>
                        <div className={styles.actionIcon}><MonitorIcon size={20} /></div>
                        <span>Lock Sync</span>
                    </button>
                </div>
            </motion.div>

            {/* Key Metrics */}
            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                        <Users size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>{teacherCount}</h4>
                    <p>Active Faculty</p>
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
                    <p>Total Students</p>
                </div>
            </motion.div>

            {/* Platform Health */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={cardVariants}>
                <div className={styles.healthHeader}>
                    <h3>System Pulse</h3>
                    <div className={styles.livePulse} />
                </div>
                <div className={styles.healthStats}>
                    <div className={styles.healthItem}>
                        <span>Auth Server</span>
                        <span className={styles.statusOk}>99.9%</span>
                    </div>
                    <div className={styles.healthItem}>
                        <span>Database</span>
                        <span className={styles.statusOk}>Healthy</span>
                    </div>
                    <div className={styles.healthItem}>
                        <span>Media Delivery</span>
                        <span className={styles.statusOk}>Optimal</span>
                    </div>
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
                    <p>Total Courses</p>
                </div>
            </motion.div>

            <motion.div className={`${styles.bentoItem} ${styles.metricCard}`} variants={cardVariants}>
                <div className={styles.metricHeader}>
                    <div className={styles.iconBox} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                        <BarChart3 size={20} />
                    </div>
                </div>
                <div className={styles.metricBody}>
                    <h4>+18%</h4>
                    <p>Monthly Growth</p>
                </div>
            </motion.div>
        </motion.div>
    );
}
