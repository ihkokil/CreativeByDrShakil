"use client";

import styles from "./TeacherSidebar.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    FileText,
    Video,
    LogOut
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type TabType = 'overview' | 'courses' | 'students' | 'assignments' | 'library';

interface TeacherSidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export default function TeacherSidebar({ activeTab, setActiveTab }: TeacherSidebarProps) {
    const { signOut } = useAuth();

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={22} /> },
        { id: 'courses', label: 'My Courses', icon: <BookOpen size={22} /> },
        { id: 'students', label: 'Students', icon: <Users size={22} /> },
        { id: 'assignments', label: 'Assignments', icon: <FileText size={22} /> },
        { id: 'library', label: 'Video Library', icon: <Video size={22} /> },
    ];

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logoArea}>
                <div className={styles.iconPlaceholder}>
                    <span className={styles.letter}>T</span>
                </div>
                <span className={styles.logoText}>Dashboard</span>
            </div>

            <nav className={styles.navLinks}>
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
                        onClick={() => setActiveTab(item.id as TabType)}
                    >
                        <span className={styles.icon}>{item.icon}</span>
                        <span className={styles.label}>{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className={styles.bottomNav}>
                <button className={styles.navItemLogout} onClick={signOut}>
                    <span className={styles.icon}><LogOut size={22} /></span>
                    <span className={styles.label}>Logout</span>
                </button>
            </div>
        </aside>
    );
}
