"use client";

import { 
    Users, 
    BookOpen, 
    UserPlus, 
    ArrowUpRight, 
    MonitorIcon, 
    Inbox, 
    ShieldCheck, 
    Briefcase, 
    CreditCard, 
    Sparkles, 
    Settings, 
    GraduationCap, 
    Layers 
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
    return (
        <div className={styles.dashboardOverview}>
            {/* 1. Hero Platform Banner */}
            <div className={styles.welcomeHero}>
                <div className={styles.welcomeInfo}>
                    <div className={styles.welcomeKicker}>
                        <Sparkles size={14} />
                        <span>System Command Center</span>
                    </div>
                    <h1 className={styles.welcomeTitle}>
                        Platform <span className="gradient-text">Overview & Control</span>
                    </h1>
                    <p className={styles.welcomeSubtitle}>
                        Real-time telemetry, user management, and enrollment governance across the academy.
                    </p>
                </div>
                <div className={styles.welcomeActions}>
                    <button onClick={() => onTabChange("payments")} className={styles.primaryActionBtn}>
                        <CreditCard size={18} /> Payment Approvals
                    </button>
                    <button onClick={() => onTabChange("teachers")} className={styles.secondaryActionBtn}>
                        <UserPlus size={18} /> Add Teacher
                    </button>
                </div>
            </div>

            {/* 2. 4-Card KPI Metric Strip */}
            <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.blueIcon}`}>
                            <Briefcase size={22} />
                        </div>
                        <span className={styles.metricBadge}>Faculty</span>
                    </div>
                    <div className={styles.metricValue}>{teacherCount}</div>
                    <div className={styles.metricLabel}>Instructors & Teachers</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.purpleIcon}`}>
                            <GraduationCap size={22} />
                        </div>
                        <span className={styles.metricBadge}>Students</span>
                    </div>
                    <div className={styles.metricValue}>{studentCount}</div>
                    <div className={styles.metricLabel}>Registered Students</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.emeraldIcon}`}>
                            <BookOpen size={22} />
                        </div>
                        <span className={styles.metricBadge}>Curriculum</span>
                    </div>
                    <div className={styles.metricValue}>{courseCount}</div>
                    <div className={styles.metricLabel}>Published Programs</div>
                </div>

                <div className={styles.metricCard}>
                    <div className={styles.metricTop}>
                        <div className={`${styles.metricIconBox} ${styles.amberIcon}`}>
                            <ShieldCheck size={22} />
                        </div>
                        <span className={styles.metricBadge}>Enrollments</span>
                    </div>
                    <div className={styles.metricValue}>{totalEnrollments}</div>
                    <div className={styles.metricLabel}>Active Enrollments</div>
                </div>
            </div>

            {/* 3. 2-Column Split: System Shortcuts & Governance */}
            <div className={styles.contentSplit}>
                {/* Left: Quick Governance Tools */}
                <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                        <div>
                            <h3 className={styles.panelCardTitle}>Platform Management</h3>
                            <p className={styles.panelCardSubtitle}>Direct administrative shortcuts</p>
                        </div>
                    </div>
                    <div className={styles.quickToolsGrid}>
                        <button onClick={() => onTabChange("students")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.blueIcon}`}>
                                <GraduationCap size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Student Directory</strong>
                                <span>Search learners & manage enrollments</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("teachers")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.purpleIcon}`}>
                                <Users size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Instructor Directory</strong>
                                <span>Manage permissions & payment access</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("users")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.amberIcon}`}>
                                <MonitorIcon size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Device Sessions</strong>
                                <span>Active devices & concurrent logins</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("payments")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.emeraldIcon}`}>
                                <CreditCard size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>bKash Payments</strong>
                                <span>Approve or reject transactions</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Right: Support & System Settings */}
                <div className={styles.panelCard}>
                    <div className={styles.panelCardHeader}>
                        <div>
                            <h3 className={styles.panelCardTitle}>Support & System</h3>
                            <p className={styles.panelCardSubtitle}>Inbound communications and config</p>
                        </div>
                    </div>
                    <div className={styles.quickToolsGrid} style={{ gridTemplateColumns: '1fr' }}>
                        <button onClick={() => onTabChange("support")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.blueIcon}`}>
                                <Inbox size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Help & Support Inquiries</strong>
                                <span>View student contact requests and messages</span>
                            </div>
                        </button>

                        <button onClick={() => onTabChange("settings")} className={styles.toolBtn}>
                            <div className={`${styles.toolIconBox} ${styles.purpleIcon}`}>
                                <Settings size={20} />
                            </div>
                            <div className={styles.toolInfo}>
                                <strong>Payment & System Settings</strong>
                                <span>bKash merchant numbers & general settings</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
