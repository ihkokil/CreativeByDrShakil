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

function TeacherDashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    const activeTab = (searchParams.get("tab") as any) || "overview";
    const pathname = usePathname();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const mobileNavItems = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'courses', label: 'Programs', icon: BookOpen },
        { id: 'library', label: 'Media', icon: Video },
    ];

    if (loading || !user) {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Authenticating...</span>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            <TeacherSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab as any}
                teacherName={user.user_metadata?.full_name || user.email?.split("@")[0] || "Teacher"}
                teacherEmail={user.email}
                isExpanded={isSidebarExpanded}
                onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
                activeStudents={0} // Logic handled internally or removed
                totalCourses={0}
            />
            
            <main className={`${styles.mainContent} ${!isSidebarExpanded ? styles.mainContentCollapsed : ''}`}>
                <TeacherHeader 
                    title="Instructor Hub"
                    user={user}
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
        <Suspense fallback={
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Syncing Instructor Profile...</span>
            </div>
        }>
            <TeacherDashboardLayoutContent>
                {children}
            </TeacherDashboardLayoutContent>
        </Suspense>
    );
}
