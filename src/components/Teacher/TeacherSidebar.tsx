"use client";


import styles from "./TeacherSidebar.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    FileText,
    Video,
    LogOut,
    Settings,
    HelpCircle,
    ChevronLeft,
    ChevronRight,
    Users as UsersIcon,
    BookOpenCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

type TabType = 'overview' | 'courses' | 'students' | 'assignments' | 'library';

interface TeacherSidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    teacherName: string;
    teacherEmail?: string;
    activeStudents: number;
    totalCourses: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export default function TeacherSidebar({ 
    activeTab, 
    setActiveTab,
    teacherName,
    teacherEmail = "teacher@example.com",
    activeStudents = 0,
    totalCourses = 0,
    isExpanded,
    onToggleExpand
}: TeacherSidebarProps) {
    const { signOut } = useAuth();

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={22} /> },
        { id: 'courses', label: 'My Courses', icon: <BookOpen size={22} /> },
        { id: 'students', label: 'Students', icon: <Users size={22} /> },
        { id: 'assignments', label: 'Assignments', icon: <FileText size={22} /> },
        { id: 'library', label: 'Video Library', icon: <Video size={22} /> },
    ];

    const settingsItems = [
        { id: 'settings', label: 'Settings', icon: <Settings size={22} /> },
        { id: 'help', label: 'Help & Support', icon: <HelpCircle size={22} /> },
    ];

    // Extract initials from teacher name
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <>
            {/* Toggle button for mobile */}
            <button
                className={styles.mobileToggle}
                onClick={() => onToggleExpand()}
                aria-label="Toggle sidebar"
            >
                {isExpanded ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
            </button>

            <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : ''}`}>
                <div className={styles.sidebarToggleDock}>
                    <button
                        className={styles.toggleBtn}
                        onClick={() => onToggleExpand()}
                        aria-label="Toggle sidebar expansion"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                    </button>
                </div>

                {/* Profile Section */}
                <div className={styles.profileSection}>
                    <div className={styles.profileHeader}>
                        <div className={styles.avatarWrapper}>
                            <div className={styles.avatar}>
                                {getInitials(teacherName)}
                            </div>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className={styles.profileInfo}>
                            <h3>{teacherName}</h3>
                            <p className={styles.role}>Instructor</p>
                        </div>
                    )}
                </div>

                {/* Quick Stats Section */}
                {isExpanded && (
                    <div className={styles.quickStats}>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}>
                                <UsersIcon size={18} />
                            </div>
                            <div className={styles.statContent}>
                                <div className={styles.statValue}>{activeStudents}</div>
                                <div className={styles.statLabel}>Active Students</div>
                            </div>
                        </div>
                        <div className={styles.statItem}>
                            <div className={styles.statIcon}>
                                <BookOpenCheck size={18} />
                            </div>
                            <div className={styles.statContent}>
                                <div className={styles.statValue}>{totalCourses}</div>
                                <div className={styles.statLabel}>Courses</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Links */}
                <nav className={styles.navLinks}>
                    <div className={styles.navSection}>
                        {menuItems.map(item => (
                            <button
                                key={item.id}
                                className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
                                onClick={() => setActiveTab(item.id as TabType)}
                                title={!isExpanded ? item.label : ""}
                            >
                                <span className={styles.icon}>{item.icon}</span>
                                {isExpanded && <span className={styles.label}>{item.label}</span>}
                            </button>
                        ))}
                    </div>

                    <div className={`${styles.navSection} ${styles.settingsSection}`}>
                        {settingsItems.map(item => (
                            <button
                                key={item.id}
                                className={styles.navItem}
                                onClick={() => setActiveTab(item.id as TabType)}
                                title={!isExpanded ? item.label : ""}
                            >
                                <span className={styles.icon}>{item.icon}</span>
                                {isExpanded && <span className={styles.label}>{item.label}</span>}
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Logout Button */}
                <div className={styles.bottomNav}>
                    <button 
                        className={styles.navItemLogout} 
                        onClick={signOut}
                        title="Logout"
                    >
                        <span className={styles.icon}><LogOut size={22} /></span>
                        {isExpanded && <span className={styles.label}>Logout</span>}
                    </button>
                </div>
            </aside>
        </>
    );
}
