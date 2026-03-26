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
    GraduationCap
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
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'profile', label: 'My Profile', icon: UserCog },
        { id: 'progress', label: 'My Progress', icon: TrendingUp },
        { id: 'exams', label: 'Exams', icon: ClipboardList },
        { id: 'browse', label: 'All Courses', icon: BookOpen, isLink: '/courses' },
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
        <aside className={`${styles.sidebar} ${!isExpanded ? styles.collapsed : ""}`}>
            <div className={styles.logoSection}>
                <Link href="/" className={styles.logoLink}>
                    <div className={styles.logoIcon}>
                        <GraduationCap className={styles.shieldIcon} size={24} />
                    </div>
                    {isExpanded && (
                        <motion.span 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={styles.logoText}
                        >
                            Student<span>Portal</span>
                        </motion.span>
                    )}
                </Link>
                <button 
                    className={styles.toggleBtn}
                    onClick={onToggleExpand}
                >
                    {isExpanded ? <ChevronLeft size={18} /> : <Menu size={18} />}
                </button>
            </div>

            <nav className={styles.nav}>
                <div className={styles.navGroup}>
                    {isExpanded && <span className={styles.groupLabel}>Learning Path</span>}
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
                            onClick={() => handleAction(item)}
                        >
                            <item.icon size={20} />
                            {isExpanded && <span>{item.label}</span>}
                            {activeTab === item.id && isExpanded && (
                                <motion.div 
                                    layoutId="activeIndicatorStudent"
                                    className={styles.activeIndicator} 
                                />
                            )}
                        </button>
                    ))}
                </div>
            </nav>

            <div className={styles.footer}>
                <div className={styles.userSection}>
                    <div className={styles.userAvatar}>
                        {studentName[0].toUpperCase()}
                    </div>
                    {isExpanded && (
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{studentName}</span>
                            <span className={styles.userRole}>Medical Student</span>
                        </div>
                    )}
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                    <LogOut size={20} />
                    {isExpanded && <span>Log Out</span>}
                </button>
            </div>
        </aside>
    );
}
