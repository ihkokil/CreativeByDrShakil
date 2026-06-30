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
    Users,
    User as UserIcon,
    GraduationCap,
    Inbox
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TabType = 'overview' | 'enrollments' | 'courses' | 'library' | 'security' | 'profile' | 'payments' | 'users' | 'students';

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
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
        { id: 'enrollments', label: 'Enrollments', icon: <Inbox size={20} /> },
        { id: 'courses', label: 'Courses', icon: <BookOpen size={20} /> },
        { id: 'students', label: 'Students', icon: <GraduationCap size={20} /> },
        { id: 'users', label: 'Users', icon: <Users size={20} /> },
        { id: 'library', label: 'Media Vault', icon: <Video size={20} /> },
        { id: 'profile', label: 'My Profile', icon: <UserIcon size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
    ];

    const { user } = useAuth();
    if (user?.user_metadata?.canManagePayments) {
        menuItems.splice(3, 0, { id: 'payments', label: 'Payments', icon: <Users size={20} /> });
    }

    const getInitials = (name: string) => {
        if (!name) return 'TR';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper}>
                    {isExpanded ? (
                        <>
                            <Image src="/logo/logo_white.webp" alt="Teacher Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-dark-theme" />
                            <Image src="/logo/logo_black.webp" alt="Teacher Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-light-theme" />
                        </>
                    ) : (
                        <Image src="/favicon.png" alt="Teacher Dashboard" width={32} height={32} style={{ objectFit: 'contain' }} priority />
                    )}
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
                                    onClick={() => {
                                        if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
                                            onToggleExpand();
                                        }
                                    }}
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
                                onClick={() => {
                                    setActiveTab(item.id as TabType);
                                    if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
                                        onToggleExpand();
                                    }
                                }}
                            >
                                <span className={styles.icon}>{item.icon}</span>
                                {isExpanded && <span className={styles.label}>{item.label}</span>}
                                {isActive && <motion.div layoutId="activeNav" className={styles.activeIndicator} />}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.footer}>

                <button className={styles.logoutButtonFull} onClick={signOut} title="Sign Out">
                    <LogOut size={18} />
                    {isExpanded && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
