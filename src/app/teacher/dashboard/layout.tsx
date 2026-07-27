"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TeacherSidebar from "@/components/Teacher/TeacherSidebar";
import TeacherHeader from "../../../components/Teacher/TeacherHeader";
import styles from "./TeacherDashboard.module.css";
import { Loader2, LayoutDashboard, BookOpen, Users, Video, FileText, MoreHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Loader from "@/components/UI/Loader";

function TeacherDashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, role } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            setIsSidebarExpanded(false);
        }
    }, []);

    const pathname = usePathname();
    const activeTab = (() => {
        if (pathname === "/teacher/dashboard") return "overview";
        if (pathname.startsWith("/teacher/dashboard/courses")) return "courses";
        if (pathname.startsWith("/teacher/dashboard/batches")) return "batches";
        if (pathname.startsWith("/teacher/dashboard/library")) return "library";
        if (pathname.startsWith("/teacher/dashboard/live")) return "live";
        if (pathname.startsWith("/teacher/dashboard/exams")) return "exams";
        if (pathname.startsWith("/teacher/dashboard/students")) return "students";
        if (pathname.startsWith("/teacher/dashboard/profile")) return "profile";
        if (pathname.startsWith("/teacher/dashboard/security")) return "security";
        if (pathname.startsWith("/teacher/dashboard/quizzes")) return "quizzes";
        return "overview";
    })();

    useEffect(() => {
        if (!loading && (!user || (role !== "teacher" && role !== "admin"))) {
            router.push("/");
        }
    }, [user, loading, role, router]);

    const setActiveTab = (tab: string) => {
        if (tab === "overview") {
            router.push(`/teacher/dashboard`);
        } else {
            router.push(`/teacher/dashboard/${tab}`);
        }
    };

    const mobileNavItems = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'courses', label: 'Programs', icon: BookOpen },
        { id: 'library', label: 'Media', icon: Video },
    ];

    if (loading || !user) {
        return <Loader text="Authenticating..." />;
    }

    return (
        <div className={styles.dashboardContainer}>
            <TeacherSidebar
                activeTab={activeTab as any}
                setActiveTab={setActiveTab as any}
                teacherName={user.user_metadata?.full_name || user.email?.split("@")[0] || "Teacher"}
                teacherEmail={user.email}
                isExpanded={isSidebarExpanded}
                onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
                activeStudents={0} // Logic handled internally or removed
                totalCourses={0}
            />
            {isSidebarExpanded && (
                <div 
                    className={styles.sidebarBackdrop} 
                    onClick={() => setIsSidebarExpanded(false)} 
                />
            )}
            
            <main className={`${styles.mainContent} ${!isSidebarExpanded ? styles.mainContentCollapsed : ''}`}>
                <TeacherHeader 
                    title="Instructor Hub"
                    user={user}
                    onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
                />
                <div className={styles.pageContent}>
                    {children}
                </div>

                {/* Mobile Bottom Nav */}
                <nav className={styles.mobileBottomNav}>
                    {mobileNavItems.map((item) => (
                        <button
                            key={item.id}
                            className={`${styles.mobileTab} ${activeTab === item.id ? styles.mobileTabActive : ""}`}
                            onClick={() => setActiveTab(item.id)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    ))}

                    <button className={styles.mobileTab} onClick={() => setIsSidebarExpanded(true)}>
                        <MoreHorizontal size={20} />
                        <span>Menu</span>
                    </button>
                </nav>
            </main>
        </div>
    );
}

import { Suspense } from "react";

export default function TeacherDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<Loader text="Syncing Instructor Profile..." />}>
            <TeacherDashboardLayoutContent>
                {children}
            </TeacherDashboardLayoutContent>
        </Suspense>
    );
}
