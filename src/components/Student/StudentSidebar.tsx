"use client";

import { useState } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { 
    LayoutDashboard, 
    UserCog, 
    BookOpen, 
    ReceiptText,
    ChevronLeft, 
    LogOut,
    ChevronRight,
    ShieldCheck,
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
        { id: 'courses', label: 'My Courses', icon: <BookOpen size={20} /> },
        { id: 'purchases', label: 'Payments', icon: <ReceiptText size={20} /> },
        { id: 'profile', label: 'Profile Settings', icon: <UserCog size={20} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={20} /> },
        { id: 'browse', label: 'All Courses', icon: <BookOpen size={20} />, isLink: '/courses' },
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
        if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
            onToggleExpand();
        }
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper}>
                    {isExpanded ? (
                        <>
                            <Image src="/logo/logo_white.webp" alt="Student Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-dark-theme" />
                            <Image src="/logo/logo_black.webp" alt="Student Dashboard" width={140} height={40} style={{ objectFit: 'contain' }} priority className="logo-light-theme" />
                        </>
                    ) : (
                        <Image src="/favicon.png" alt="Student Dashboard" width={32} height={32} style={{ objectFit: 'contain' }} priority />
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
