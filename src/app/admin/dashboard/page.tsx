"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import styles from "./AdminDashboard.module.css";
import {
    Users,
    BookOpen,
    DollarSign,
    Shield,
    Plus,
    UserPlus,
    Settings,
    BarChart3,
    GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";

interface TeacherProfile {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email?: string;
}

export default function AdminDashboard() {
    const { user, loading, role } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'teachers'>('overview');
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);

    useEffect(() => {
        if (!loading && (!user || role !== 'admin')) {
            router.push("/");
        }
    }, [user, loading, role, router]);

    const fetchTeachers = useCallback(async () => {
        setTeachersLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/admin/teachers', {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (response.ok && Array.isArray(data.teachers)) {
            setTeachers(data.teachers);
        } else {
            setTeachers([]);
        }
        setTeachersLoading(false);
    }, []);

    useEffect(() => {
        if (user && role === 'admin') {
            fetchTeachers();
        }
    }, [user, role, fetchTeachers]);

    if (loading || !user || role !== 'admin') {
        return <div className={styles.loader}>Loading Admin Panel...</div>;
    }

    const stats = [
        { label: "Teachers", value: teachers.length.toString(), icon: <Users size={24} />, color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
        { label: "Students", value: "842", icon: <GraduationCap size={24} />, color: "#ec4899", bg: "rgba(236, 72, 153, 0.1)" },
        { label: "Courses", value: "24", icon: <BookOpen size={24} />, color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
        { label: "Revenue", value: "৳5,25,000", icon: <DollarSign size={24} />, color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
    ];

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <main className={styles.main}>
            <Navbar />

            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.welcome}>
                        <h1>Admin <span className="gradient-text">Dashboard</span></h1>
                        <p>Welcome back, {user.user_metadata?.full_name || 'Admin'}. Manage your platform from here.</p>
                    </div>
                    <div className={styles.stats}>
                        {stats.map((stat, index) => (
                            <div key={index} className={styles.statCard}>
                                <div className={styles.statIcon} style={{ color: stat.color, background: stat.bg }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <h3>{stat.value}</h3>
                                    <label>{stat.label}</label>
                                </div>
                            </div>
                        ))}
                    </div>
                </header>

                <div className={styles.tabNav}>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'teachers' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('teachers')}
                    >
                        Manage Teachers
                    </button>
                </div>

                {activeTab === 'overview' && (
                    <div className={styles.overviewGrid}>
                        <section className={styles.mainContent}>
                            <h2>Quick <span className="gradient-text">Actions</span></h2>
                            <div className={styles.quickActions}>
                                <motion.div
                                    className={styles.actionCard}
                                    whileHover={{ y: -5 }}
                                    onClick={() => { setActiveTab('teachers'); setIsAddTeacherOpen(true); }}
                                >
                                    <div className={styles.actionIcon} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                                        <UserPlus size={24} />
                                    </div>
                                    <div>
                                        <h3>Add New Teacher</h3>
                                        <p>Invite a teacher to the platform via email</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    className={styles.actionCard}
                                    whileHover={{ y: -5 }}
                                    onClick={() => setActiveTab('teachers')}
                                >
                                    <div className={styles.actionIcon} style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                                        <Users size={24} />
                                    </div>
                                    <div>
                                        <h3>View All Teachers</h3>
                                        <p>Manage existing teacher accounts</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    className={styles.actionCard}
                                    whileHover={{ y: -5 }}
                                >
                                    <div className={styles.actionIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                        <BookOpen size={24} />
                                    </div>
                                    <div>
                                        <h3>Manage Courses</h3>
                                        <p>Create and edit course content</p>
                                    </div>
                                </motion.div>

                                <motion.div
                                    className={styles.actionCard}
                                    whileHover={{ y: -5 }}
                                >
                                    <div className={styles.actionIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <h3>View Analytics</h3>
                                        <p>Track platform performance metrics</p>
                                    </div>
                                </motion.div>
                            </div>
                        </section>

                        <aside className={styles.sidebar}>
                            <div className={styles.sidebarCard}>
                                <h3>Recent Teachers</h3>
                                <div className={styles.activityList}>
                                    {teachers.length > 0 ? teachers.slice(0, 3).map(teacher => (
                                        <div key={teacher.id} className={styles.activityItem}>
                                            <div className={styles.activityItemIcon}>
                                                <Users size={18} />
                                            </div>
                                            <div className={styles.activityInfo}>
                                                <h4>{teacher.full_name}</h4>
                                                <span>Added {new Date(teacher.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    )) : (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No teachers added yet.</p>
                                    )}
                                </div>
                            </div>

                            <div className={`${styles.sidebarCard} ${styles.purpleCard}`}>
                                <h3>Platform Settings</h3>
                                <p>Configure email templates, branding, and access controls for your platform.</p>
                                <button className={styles.settingsBtn}>
                                    <Settings size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                                    Open Settings
                                </button>
                            </div>
                        </aside>
                    </div>
                )}

                {activeTab === 'teachers' && (
                    <div className={styles.teacherSection}>
                        <div className={styles.sectionHeader}>
                            <h2>Manage <span className="gradient-text">Teachers</span></h2>
                            <button
                                className={styles.addTeacherBtn}
                                onClick={() => setIsAddTeacherOpen(true)}
                            >
                                <Plus size={20} />
                                Add Teacher
                            </button>
                        </div>

                        {teachersLoading ? (
                            <div className={styles.loader} style={{ height: 'auto', padding: '60px' }}>
                                Loading teachers...
                            </div>
                        ) : teachers.length > 0 ? (
                            <div className={styles.teacherTable}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Teacher</th>
                                            <th>Role</th>
                                            <th>Joined</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachers.map(teacher => (
                                            <tr key={teacher.id}>
                                                <td>
                                                    <div className={styles.teacherName}>
                                                        <div className={styles.avatar}>
                                                            {getInitials(teacher.full_name || 'T')}
                                                        </div>
                                                        <div className={styles.teacherNameText}>
                                                            <h4>{teacher.full_name}</h4>
                                                            <span>{teacher.email || 'Email pending'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                                                    {teacher.role}
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>
                                                    {new Date(teacher.created_at).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${styles.statusActive}`}>
                                                        Active
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={styles.emptyState}>
                                <Users size={60} className={styles.emptyIcon} />
                                <h3>No Teachers Yet</h3>
                                <p>Start building your teaching team by inviting your first teacher.</p>
                                <button
                                    className={styles.addTeacherBtn}
                                    onClick={() => setIsAddTeacherOpen(true)}
                                >
                                    <UserPlus size={20} />
                                    Add Your First Teacher
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AddTeacherModal
                isOpen={isAddTeacherOpen}
                onClose={() => setIsAddTeacherOpen(false)}
                onSuccess={() => {
                    setIsAddTeacherOpen(false);
                    fetchTeachers();
                }}
            />

            <Footer />
        </main>
    );
}
