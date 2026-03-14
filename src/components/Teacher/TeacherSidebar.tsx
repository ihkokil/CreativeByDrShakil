"use client";

import { motion } from "framer-motion";
import styles from "./TeacherSidebar.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    FileText,
    Video,
    LogOut,
    Settings,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

type TabType = 'overview' | 'courses' | 'students' | 'assignments' | 'library';

interface TeacherSidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    teacherName: string;
    teacherEmail?: string;
    isExpanded: boolean;
    onToggleExpand: () => void;
    activeStudents?: number;
    totalCourses?: number;
}

export default function TeacherSidebar({ 
    activeTab, 
    setActiveTab,
    teacherName,
    teacherEmail,
    isExpanded,
    onToggleExpand
}: TeacherSidebarProps) {
    const { signOut } = useAuth();

    const menuItems = [
        { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'courses', label: 'Programs', icon: <BookOpen size={20} /> },
        { id: 'students', label: 'Students', icon: <Users size={20} /> },
        { id: 'assignments', label: 'Assessments', icon: <FileText size={20} /> },
        { id: 'library', label: 'Media Vault', icon: <Video size={20} /> },
    ];

    const sysItems = [
        { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
    ];

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper}>
                    <div className={styles.logoIcon}>C</div>
                    {isExpanded && <span className={styles.logoText}>Creative<span>Academy</span></span>}
                </Link>
                <button className={styles.toggleBtn} onClick={onToggleExpand}>
                    {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            <div className={styles.navContainer}>
                <div className={styles.navSection}>
                    {isExpanded && <span className={styles.sectionLabel}>Management</span>}
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
                            onClick={() => setActiveTab(item.id as TabType)}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            {isExpanded && <span className={styles.label}>{item.label}</span>}
                            {activeTab === item.id && <motion.div layoutId="activeNav" className={styles.activeIndicator} />}
                        </button>
                    ))}
                </div>

                <div className={styles.navSection}>
                    {isExpanded && <span className={styles.sectionLabel}>System</span>}
                    {sysItems.map(item => (
                        <button
                            key={item.id}
                            className={styles.navItem}
                            onClick={() => {}}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            {isExpanded && <span className={styles.label}>{item.label}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.profileBox}>
                    <div className={styles.avatar}>
                        {getInitials(teacherName)}
                    </div>
                    {isExpanded && (
                        <div className={styles.profileMeta}>
                            <span className={styles.name}>{teacherName}</span>
                            <span className={styles.email}>Instructor Account</span>
                        </div>
                    )}
                    {isExpanded && (
                        <button className={styles.logoutBtn} onClick={signOut} title="Sign Out">
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}

// Support for Framer Motion inside this file if I want, but I'll skip to keep it simple for now or import it correctly.
import { motion } from "framer-motion";
