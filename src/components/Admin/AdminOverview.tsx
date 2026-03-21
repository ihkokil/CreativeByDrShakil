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
    totalRevenue: string;
    onTabChange: (tab: string) => void;
}

export default function AdminOverview({
    teacherCount,
    studentCount,
    courseCount,
    totalRevenue,
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
            <motion.div className={`${styles.bentoCard} ${styles.large}`} variants={cardVariants}>
                <div className={styles.revenueHeader}>
                    <div>
                        <span className={styles.label}>Platform Revenue</span>
                        <h2 className={styles.revenueAmount}>{totalRevenue}</h2>
                    </div>
                    <div className={styles.trendUp}>
                        <TrendingUp size={16} />
                        <span>+12.5%</span>
                    </div>
                </div>
                <div className={styles.revenueChartPlaceholder}>
                    {/* Simplified Chart representation */}
                    <div className={styles.chartBars}>
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
                <button className={styles.cardAction} onClick={() => onTabChange('analytics')}>
                    Detailed Financials <ArrowRight size={16} />
                </button>
            </motion.div>

            {/* Quick Actions */}
            <motion.div className={`${styles.bentoCard} ${styles.medium}`} variants={cardVariants}>
                <h3 className={styles.cardTitle}>Quick Management</h3>
                <div className={styles.quickActions}>
                    <button className={styles.actionItem} onClick={() => onTabChange('teachers')}>
                        <UserPlus size={20} />
                        <span>Invite Teacher</span>
                    </button>
                    <button className={styles.actionItem} onClick={() => onTabChange('coupons')}>
                        <TrendingUp size={20} />
                        <span>New Offer</span>
                    </button>
                    <button className={styles.actionItem} onClick={() => onTabChange('sessions')}>
                        <MonitorIcon size={20} />
                        <span>Lock Sync</span>
                    </button>
                </div>
            </motion.div>

            {/* Key Metrics */}
            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    <Users size={20} />
                </div>
                <h3 className={styles.metricValue}>{teacherCount}</h3>
                <p className={styles.metricLabel}>Active Faculty</p>
            </motion.div>

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <Users size={20} />
                </div>
                <h3 className={styles.metricValue}>{studentCount}</h3>
                <p className={styles.metricLabel}>Total Students</p>
            </motion.div>

            {/* Platform Health */}
            <motion.div className={`${styles.bentoCard} ${styles.medium}`} variants={cardVariants}>
                <div className={styles.healthHeader}>
                    <h3 className={styles.cardTitle}>System Pulse</h3>
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

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                    <BookOpen size={20} />
                </div>
                <h3 className={styles.metricValue}>{courseCount}</h3>
                <p className={styles.metricLabel}>Total Courses</p>
            </motion.div>

            <motion.div className={styles.bentoCard} variants={cardVariants}>
                <div className={styles.metricIcon} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                    <BarChart3 size={20} />
                </div>
                <h3 className={styles.metricValue}>+18%</h3>
                <p className={styles.metricLabel}>Monthly Growth</p>
            </motion.div>
        </motion.div>
    );
}
