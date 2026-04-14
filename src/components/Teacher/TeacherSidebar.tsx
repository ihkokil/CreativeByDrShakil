"use client";

import { motion } from "framer-motion";
import styles from "./TeacherSidebar.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Video,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    Users
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TabType = 'overview' | 'courses' | 'library' | 'security';

interface TeacherSidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    teacherName: string;
    teacherEmail?: string;
    teacherProfileImage?: string | null;
    isExpanded: boolean;
    onToggleExpand: () => void;
    activeStudents?: number;
    totalCourses?: number;
}

export default function TeacherSidebar({ 
    activeTab, 
    setActiveTab,
    teacherName,
    teacherEmail = "teacher@example.com",
    teacherProfileImage = null,
    activeStudents = 0,
    totalCourses = 0,
    isExpanded,
    onToggleExpand
}: TeacherSidebarProps) {
    const { signOut } = useAuth();
    const pathname = usePathname();

    const menuItems = [
        { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'courses', label: 'Programs', icon: <BookOpen size={20} /> },
        { id: 'library', label: 'Media Vault', icon: <Video size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
    ];

    const sysItems: any[] = [
        // Settings removed as no teacher settings page exists yet
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
                    {menuItems.map(item => {
                        const isRouteItem = !!(item as any).href;
                        const isActive = isRouteItem
                            ? pathname?.startsWith((item as any).href)
                            : activeTab === item.id;

                        if (isRouteItem) {
                            return (
                                <Link
                                    key={item.id}
                                    href={(item as any).href}
                                    className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                >
                                    <span className={styles.icon}>{item.icon}</span>
                                    {isExpanded && <span className={styles.label}>{item.label}</span>}
                                    {isActive && <motion.div layoutId="activeNav" className={styles.activeIndicator} />}
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                onClick={() => setActiveTab(item.id as TabType)}
                            >
                                <span className={styles.icon}>{item.icon}</span>
                                {isExpanded && <span className={styles.label}>{item.label}</span>}
                                {isActive && <motion.div layoutId="activeNav" className={styles.activeIndicator} />}
                            </button>
                        );
                    })}
                </div>

                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.profileBox}>
                    <div className={styles.avatar}>
                        {teacherProfileImage ? (
                            <Image 
                                src={teacherProfileImage} 
                                alt={teacherName} 
                                fill 
                                className={styles.avatarImage}
                                unoptimized
                            />
                        ) : (
                            getInitials(teacherName)
                        )}
                    </div>
                    {isExpanded && (
                        <div className={styles.profileMeta}>
                            <span className={styles.name}>{teacherName}</span>
                            <span className={styles.email}>{teacherEmail}</span>
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
