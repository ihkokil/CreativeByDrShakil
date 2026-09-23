"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import StudentSidebar from "@/components/Student/StudentSidebar";
import StudentHeader from "@/components/Student/StudentHeader";
import styles from "@/app/dashboard/StudentDashboard.module.css";
import Loader from "@/components/UI/Loader";

function StudyLayoutContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, role } = useAuth();
    const router = useRouter();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth <= 768) {
            setIsSidebarExpanded(false);
        }
    }, []);

    const pathname = usePathname();

    useEffect(() => {
        if (!loading && (!user || (role !== "student" && role !== "teacher" && role !== "admin"))) {
            router.push("/");
        }
    }, [user, loading, role, router]);

    const setActiveTab = (tab: string) => {
        if (tab === "overview") {
            router.push(`/dashboard`);
        } else {
            router.push(`/dashboard/${tab}`);
        }
    };

    if (loading || !user) {
        return <Loader text="Entering Study Room..." />;
    }

    return (
        <div className={styles.dashboardContainer}>
            <StudentSidebar
                activeTab="courses"
                setActiveTab={setActiveTab as any}
                studentName={user.user_metadata?.full_name || "Student"}
                isExpanded={isSidebarExpanded}
                onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
            />
            {isSidebarExpanded && (
                <div 
                    className={styles.sidebarBackdrop} 
                    onClick={() => setIsSidebarExpanded(false)} 
                />
            )}
            
            <main className={`${styles.mainContent} ${!isSidebarExpanded ? styles.mainContentCollapsed : ''}`}>
                <StudentHeader 
                    title="Course Study Room"
                    user={user}
                    onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
                />
                <div className={styles.pageContent} style={{ padding: 0 }}>
                    {children}
                </div>
            </main>
        </div>
    );
}

export default function StudyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<Loader text="Preparing Study Workspace..." />}>
            <StudyLayoutContent>
                {children}
            </StudyLayoutContent>
        </Suspense>
    );
}
