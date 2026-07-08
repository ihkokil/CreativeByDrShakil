"use client";

import { useState, useEffect } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { 
    LayoutDashboard, 
    Users, 
    Smartphone, 
    CreditCard,
    ChevronLeft, 
    LogOut,
    GraduationCap,
    ChevronRight,
    LayoutGrid,
    Inbox,
    BookOpen,
    Shield,
    ShieldCheck,
    Settings,
    UserCog
} from 'lucide-react';
import styles from "@/components/Teacher/TeacherSidebar.module.css";
import { motion } from "framer-motion";
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

    const handleAction = (item: any) => {
        if (item.isLink) {
            router.push(item.isLink);
        } else {
            setActiveTab(item.id);
        }
        if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
            onToggleExpand();
        }
    };

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
        { id: 'enrollments', label: 'Enrollments', icon: <BookOpen size={20} /> },
        { id: 'students', label: 'Students', icon: <GraduationCap size={20} /> },
        { id: 'users', label: 'Users', icon: <Users size={20} /> },
        { id: 'teachers', label: 'Teachers', icon: <UserCog size={20} /> },
        { id: 'payments', label: 'Payments', icon: <CreditCard size={20} /> },
        { id: 'support', label: 'Contact Help', icon: <Inbox size={20} /> },
    ];

    const sysItems = [
        { id: 'profile', label: 'My Profile', icon: <UserCog size={20} /> },
        { id: 'settings', label: 'Financials', icon: <Settings size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
    ];

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper}>
                    {isExpanded ? (
                        <>
                            <Image src="/logo/logo_white.webp" alt="Admin Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-dark-theme" />
                            <Image src="/logo/logo_black.webp" alt="Admin Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-light-theme" />
                        </>
                    ) : (
                        <Image src="/favicon.png" alt="Admin Dashboard" width={32} height={32} style={{ objectFit: 'contain' }} priority />
                    )}
                </Link>
                <button className={styles.toggleBtn} onClick={onToggleExpand}>
                    {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            <div className={styles.navContainer}>
                <div className={styles.navSection}>
                    {isExpanded && <span className={styles.sectionLabel}>Management</span>}
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.navItem} ${activeTab === item.id ? styles.active : ""}`}
                            onClick={() => handleAction(item)}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            {isExpanded && <span className={styles.label}>{item.label}</span>}
                            {activeTab === item.id && (
                                <motion.div layoutId="activeIndicatorAdmin" className={styles.activeIndicator} />
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
                                <motion.div layoutId="activeIndicatorAdmin" className={styles.activeIndicator} />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.footer}>

                <button className={styles.logoutButtonFull} onClick={handleLogout} title="Sign Out">
                    <LogOut size={18} />
                    {isExpanded && <span>Sign Out</span>}
                </button>
            </div>
        </aside>
    );
}
