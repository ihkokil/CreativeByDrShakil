"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    LayoutDashboard,
    UserCog,
    BookOpen,
    CreditCard,
    LogOut,
    ShieldCheck,
    ClipboardList,
    X,
} from 'lucide-react';
import styles from "@/components/Teacher/TeacherSidebar.module.css";
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
}: StudentSidebarProps) {
    const { signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isExpanded) {
                onToggleExpand();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isExpanded, onToggleExpand]);

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} /> },
        { id: 'courses', label: 'My Courses', icon: <BookOpen size={19} /> },
        { id: 'purchases', label: 'Payments', icon: <CreditCard size={19} /> },
        { id: 'quizzes', label: 'Quizzes', icon: <ClipboardList size={19} /> },
        { id: 'profile', label: 'Profile', icon: <UserCog size={19} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={19} /> },
        { id: 'browse', label: 'All Courses', icon: <BookOpen size={19} />, isLink: '/courses' },
    ];

    const handleLogout = async () => {
        if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
            onToggleExpand();
        }
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
                <Link href="/" className={styles.logoWrapper} title="Creative by Dr. Shakil">
                    <Image src="/favicon.webp" alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} priority />
                    <div className={styles.brandText}>
                        <span className={styles.brandTitle}>Creative</span>
                        <span className={styles.brandSubtitle}>Student Portal</span>
                    </div>
                </Link>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={onToggleExpand}
                    aria-label="Close sidebar"
                    title="Close sidebar"
                >
                    <X size={20} />
                </button>
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
