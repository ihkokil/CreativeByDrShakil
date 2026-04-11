"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import StudentSidebar from "@/components/Student/StudentSidebar";
import StudentHeader from "@/components/Student/StudentHeader";
import styles from "./StudentDashboard.module.css";
import { Loader2, LayoutDashboard, UserCog, TrendingUp, ClipboardList, BookOpen, MoreHorizontal, ShieldCheck } from "lucide-react";

function StudentDashboardLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    const activeTab = (searchParams.get("tab") as any) || "overview";

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
        { id: 'courses', label: 'Courses', icon: BookOpen },
        { id: 'profile', label: 'Profile', icon: UserCog },
        { id: 'security', label: 'Security', icon: ShieldCheck },
    ];

    if (loading || !user) {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Entering Learning Hub...</span>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            <StudentSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab as any}
                studentName={user.user_metadata?.full_name || "Student"}
                isExpanded={isSidebarExpanded}
                onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
            />
            
            <main className={`${styles.mainContent} ${!isSidebarExpanded ? styles.mainContentCollapsed : ''}`}>
                <StudentHeader 
                    title="Learning Center"
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

export default function StudentDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Preparing Student Workspace...</span>
            </div>
        }>
            <StudentDashboardLayoutContent>
                {children}
            </StudentDashboardLayoutContent>
        </Suspense>
    );
}
