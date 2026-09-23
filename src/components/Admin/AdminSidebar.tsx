"use client";

import Link from 'next/link';
import Image from 'next/image';
import {
    LayoutDashboard,
    Users,
    CreditCard,
    LogOut,
    GraduationCap,
    Inbox,
    ShieldCheck,
    Settings,
    UserCog,
    ClipboardList,
} from 'lucide-react';
import styles from "@/components/Teacher/TeacherSidebar.module.css";
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
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} /> },
        { id: 'students', label: 'Students', icon: <GraduationCap size={19} /> },
        { id: 'users', label: 'Users', icon: <Users size={19} /> },
        { id: 'teachers', label: 'Teachers', icon: <UserCog size={19} /> },
        { id: 'quizzes', label: 'Quizzes', icon: <ClipboardList size={19} /> },
        { id: 'payments', label: 'Payments', icon: <CreditCard size={19} /> },
        { id: 'support', label: 'Help Desk', icon: <Inbox size={19} /> },
        { id: 'profile', label: 'My Profile', icon: <UserCog size={19} /> },
        { id: 'settings', label: 'Financials', icon: <Settings size={19} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={19} /> },
    ];

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper} title="Creative by Dr. Shakil">
                    <Image src="/favicon.webp" alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} priority />
                </Link>
            </div>

            <div className={styles.navContainer}>
                <div className={styles.navSection}>
                    {menuItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                            <button
                                key={item.id}
                                className={`${styles.navItem} ${isActive ? styles.active : ""}`}
                                onClick={() => handleAction(item)}
                                title={item.label}
                            >
                                <div className={styles.iconBadge}>
                                    {item.icon}
                                </div>
                                <span className={styles.label}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.footer}>
                <button className={styles.logoutBtn} onClick={handleLogout} title="Sign Out">
                    <div className={styles.iconBadge}>
                        <LogOut size={17} />
                    </div>
                    <span className={styles.label}>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
