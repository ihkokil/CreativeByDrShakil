"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { 
    LayoutDashboard, 
    Users, 
    Smartphone, 
    TicketPercent, 
    BarChart3, 
    Settings, 
    ChevronLeft, 
    LogOut,
    Menu,
    Shield
} from 'lucide-react';
import styles from "@/components/Teacher/TeacherSidebar.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface AdminSidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
    adminName: string;
}

export default function AdminSidebar({
    activeTab,
    setActiveTab,
    isExpanded,
    onToggleExpand,
    adminName
}: AdminSidebarProps) {
    const { signOut } = useAuth();
    const router = useRouter();

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'teachers', label: 'Teachers', icon: Users },
        { id: 'coupons', label: 'Coupons', icon: TicketPercent },
        { id: 'sessions', label: 'Sessions', icon: Smartphone },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <aside className={`${styles.sidebar} ${!isExpanded ? styles.collapsed : ""}`}>
            <div className={styles.logoSection}>
                <Link href="/" className={styles.logoLink}>
                    <div className={styles.logoIcon}>
                        <Shield className={styles.shieldIcon} size={24} />
                    </div>
                    {isExpanded && (
                        <motion.span 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={styles.logoText}
                        >
                            Admin<span>Panel</span>
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
                    {isExpanded && <span className={styles.groupLabel}>Main Menu</span>}
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <item.icon size={20} />
                            {isExpanded && <span>{item.label}</span>}
                            {activeTab === item.id && isExpanded && (
                                <motion.div 
                                    layoutId="activeIndicator"
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
                        {adminName[0].toUpperCase()}
                    </div>
                    {isExpanded && (
                        <div className={styles.userInfo}>
                            <span className={styles.userName}>{adminName}</span>
                            <span className={styles.userRole}>Security Master</span>
                        </div>
                    )}
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                    <LogOut size={20} />
                    {isExpanded && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
