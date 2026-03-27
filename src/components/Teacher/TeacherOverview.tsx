"use client";

import { motion } from "framer-motion";
import { 
    Users, 
    BookOpen, 
    Star, 
    DollarSign, 
    TrendingUp, 
    ArrowUpRight, 
    Play, 
    Plus,
    Calendar,
    MessageSquare,
    MoreVertical
} from "lucide-react";
import styles from "./TeacherOverview.module.css";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function TeacherOverview() {
    const router = useRouter();

    const stats = [
        { label: "Active Students", value: "842", change: "+5.2%", icon: <Users size={20} />, color: "#3b82f6" },
        { label: "Total Enrollments", value: "1,250", change: "+12.5%", icon: <TrendingUp size={20} />, color: "#8b5cf6" },
        { label: "Total Courses", value: "4", change: "0%", icon: <BookOpen size={20} />, color: "#10b981" },
        { label: "Avg. Rating", value: "4.9", change: "+0.1", icon: <Star size={20} />, color: "#f59e0b" },
    ];

    const recentActivity = [
        { id: 1, type: 'enrollment', user: 'Dr. Sarah J.', course: 'FCPS Part 1', time: '2 mins ago', info: 'New enrollment' },
        { id: 2, type: 'completion', user: 'Arif Ahmed', course: 'Surgery Secrets', time: '1 hour ago', info: 'Completed course' },
        { id: 3, type: 'enrollment', user: 'Fatima Khan', course: 'Pediatrics Pro', time: '3 hours ago', info: 'New enrollment' },
    ];

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
            {/* 1. Main Stats Section */}
            <motion.div className={`${styles.bentoItem} ${styles.statsHero}`} variants={item}>
                <div className={styles.heroHeader}>
                    <div>
                        <h2>Enrollment Overview</h2>
                        <p>Total enrollments this month</p>
                    </div>
                    <div className={styles.heroAction}>
                        <TrendingUp size={16} /> <span>14% increase</span>
                    </div>
                </div>
                <div className={styles.revenueDisplay}>
                    <span className={styles.amount}>1,250</span>
                    <span className={styles.currency} style={{marginLeft: '10px', alignSelf: 'flex-end', paddingBottom: '10px'}}>Students</span>
                </div>
                <div className={styles.miniChart}>
                    {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                        <div key={i} className={styles.bar} style={{ height: `${h}%` }} />
                    ))}
                </div>
            </motion.div>

            {/* 2. Quick Actions */}
            <motion.div className={`${styles.bentoItem} ${styles.quickActions}`} variants={item}>
                <h3>Quick Actions</h3>
                <div className={styles.actionGrid}>
                    <button onClick={() => router.push('/teacher/dashboard/courses/create')} className={styles.actionBtn}>
                        <div className={styles.actionIcon}><Plus size={18} /></div>
                        <span>Create Course</span>
                    </button>
                    <button className={styles.actionBtn}>
                        <div className={styles.actionIcon}><Play size={18} /></div>
                        <span>Upload Video</span>
                    </button>
                    <button className={styles.actionBtn}>
                        <div className={styles.actionIcon}><Calendar size={18} /></div>
                        <span>Schedule Live</span>
                    </button>
                    <button className={styles.actionBtn}>
                        <div className={styles.actionIcon}><MessageSquare size={18} /></div>
                        <span>Messages</span>
                    </button>
                </div>
            </motion.div>

            {/* 3. Metrics Cards */}
            {stats.slice(1).map((stat, i) => (
                <motion.div key={i} className={`${styles.bentoItem} ${styles.metricCard}`} variants={item}>
                    <div className={styles.metricHeader}>
                        <div className={styles.iconBox} style={{ color: stat.color, background: `${stat.color}15` }}>
                            {stat.icon}
                        </div>
                        <span className={styles.metricChange}>{stat.change}</span>
                    </div>
                    <div className={styles.metricBody}>
                        <h4>{stat.value}</h4>
                        <p>{stat.label}</p>
                    </div>
                </motion.div>
            ))}

            {/* 4. Recent Activity */}
            <motion.div className={`${styles.bentoItem} ${styles.activityList}`} variants={item}>
                <div className={styles.cardHeader}>
                    <h3>Recent Activity</h3>
                    <button className={styles.moreBtn}><MoreVertical size={16} /></button>
                </div>
                <div className={styles.activities}>
                    {recentActivity.map((act) => (
                        <div key={act.id} className={styles.activityItem}>
                            <div className={styles.actAvatar}>
                                {act.user[0]}
                            </div>
                            <div className={styles.actInfo}>
                                <strong>{act.user}</strong>
                                <span>{act.type === 'enrollment' ? 'Enrolled in' : 'Completed'} {act.course}</span>
                                <small>{act.time}</small>
                            </div>
                            <div className={styles.actValue}>
                                <span className={styles.statusPill}>{act.info}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <button className={styles.viewAllBtn}>View All Activity <ArrowUpRight size={14} /></button>
            </motion.div>

            {/* 5. Course Performance Teaser */}
            <motion.div className={`${styles.bentoItem} ${styles.performanceTeaser}`} variants={item}>
                <h3>Top Performing Course</h3>
                <div className={styles.teaserContent}>
                    <div className={styles.teaserThumb}>
                        <Image src="/placeholder.svg" alt="Course" fill style={{ objectFit: 'cover' }} />
                    </div>
                    <div className={styles.teaserInfo}>
                        <h4>FCPS Part 1 Preparation</h4>
                        <div className={styles.teaserStats}>
                            <span><Users size={12} /> 420 Students</span>
                            <span><Star size={12} /> 4.9 Rating</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
