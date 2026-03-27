"use client";

import { useState } from "react";
import Link from 'next/link';
import { 
    LayoutDashboard, 
    UserCog, 
    TrendingUp, 
    ClipboardList, 
    BookOpen, 
    ChevronLeft, 
    LogOut,
    Menu,
    GraduationCap,
    ChevronRight,
    Settings
} from 'lucide-react';
import styles from "@/components/Teacher/TeacherSidebar.module.css";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface StudentSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    studentName: string;
}

export default function StudentSidebar({
    activeTab,
    setActiveTab,
    isExpanded,
    onToggleExpand,
    studentName
}: StudentSidebarProps) {
    const { signOut } = useAuth();
    const router = useRouter();

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
        { id: 'profile', label: 'My Profile', icon: <UserCog size={20} /> },
        { id: 'progress', label: 'My Progress', icon: <TrendingUp size={20} /> },
        { id: 'browse', label: 'All Courses', icon: <BookOpen size={20} />, isLink: '/courses' },
    ];

    const sysItems = [
        { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
    ];

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    const handleAction = (item: any) => {
        if (item.isLink) {
            router.push(item.isLink);
        } else {
            setActiveTab(item.id);
        }
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper}>
                    <div className={styles.logoIcon}>
                        <GraduationCap className={styles.shieldIcon} size={24} />
                    </div>
                    {isExpanded && (
                        <span className={styles.logoText}>
                            Student<span>Portal</span>
                        </span>
                    )}
                </Link>
                <button className={styles.toggleBtn} onClick={onToggleExpand}>
                    {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            <div className={styles.navContainer}>
                <div className={styles.navSection}>
                    {isExpanded && <span className={styles.sectionLabel}>Learning Path</span>}
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
                            onClick={() => handleAction(item)}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            {isExpanded && <span className={styles.label}>{item.label}</span>}
                            {activeTab === item.id && (
                                <motion.div layoutId="activeIndicatorStudent" className={styles.activeIndicator} />
                            )}
                        </button>
                    ))}
                </div>

                <div className={styles.navSection}>
                    {isExpanded && <span className={styles.sectionLabel}>System</span>}
                    {sysItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
                            onClick={() => handleAction(item)}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            {isExpanded && <span className={styles.label}>{item.label}</span>}
                            {activeTab === item.id && (
                                <motion.div layoutId="activeIndicatorStudent" className={styles.activeIndicator} />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.footer}>
                <div className={styles.profileBox}>
                    <div className={styles.avatar}>
                        {studentName[0].toUpperCase()}
                    </div>
                    {isExpanded && (
                        <div className={styles.profileMeta}>
                            <span className={styles.name}>{studentName}</span>
                            <span className={styles.email}>Medical Student</span>
                        </div>
                    )}
                    {isExpanded && (
                        <button className={styles.logoutBtn} onClick={handleLogout} title="Sign Out">
                            <LogOut size={16} />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
}
