"use client";

import styles from "./TeacherSidebar.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Video,
    LogOut,
    ShieldCheck,
    Users,
    User as UserIcon,
    GraduationCap,
    FileQuestion,
    Layers,
    CreditCard,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TabType = 'overview' | 'enrollments' | 'courses' | 'batches' | 'quizzes' | 'library' | 'security' | 'profile' | 'payments' | 'users' | 'students';

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
    isExpanded,
    onToggleExpand
}: TeacherSidebarProps) {
    const { signOut, user } = useAuth();
    const pathname = usePathname();

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} /> },
        { id: 'courses', label: 'Courses', icon: <BookOpen size={19} /> },
        { id: 'batches', label: 'Batches', icon: <Layers size={19} /> },
        { id: 'quizzes', label: 'Quizzes', icon: <FileQuestion size={19} /> },
        { id: 'students', label: 'Students', icon: <GraduationCap size={19} /> },
        { id: 'users', label: 'Users', icon: <Users size={19} /> },
        { id: 'library', label: 'Media Vault', icon: <Video size={19} /> },
        { id: 'profile', label: 'My Profile', icon: <UserIcon size={19} /> },
        { id: 'security', label: 'Security', icon: <ShieldCheck size={19} /> },
    ];

    if (user?.user_metadata?.canManagePayments) {
        menuItems.splice(3, 0, { id: 'payments', label: 'Payments', icon: <CreditCard size={19} /> });
    }

    return (
        <aside className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            <div className={styles.sidebarHeader}>
                <Link href="/" className={styles.logoWrapper} title="Creative by Dr. Shakil">
                    <Image src="/favicon.webp" alt="Logo" width={32} height={32} style={{ objectFit: 'contain' }} priority />
                </Link>
            </div>

            <div className={styles.navContainer}>
                <div className={styles.navSection}>
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
                                    title={item.label}
                                    onClick={() => {
                                        if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
                                            onToggleExpand();
                                        }
                                    }}
                                >
                                    <div className={styles.iconBadge}>
                                        {item.icon}
                                    </div>
                                    <span className={styles.label}>{item.label}</span>
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                title={item.label}
                                onClick={() => {
                                    setActiveTab(item.id as TabType);
                                    if (typeof window !== "undefined" && window.innerWidth <= 768 && isExpanded) {
                                        onToggleExpand();
                                    }
                                }}
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
                <button className={styles.logoutBtn} onClick={signOut} title="Sign Out">
                    <div className={styles.iconBadge}>
                        <LogOut size={17} />
                    </div>
                    <span className={styles.label}>Sign Out</span>
                </button>
            </div>
        </aside>
    );
}
