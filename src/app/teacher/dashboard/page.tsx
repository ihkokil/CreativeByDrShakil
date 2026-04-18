"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState, Suspense } from "react";
import TeacherOverview from "@/components/Teacher/TeacherOverview";
import VideoLibraryManager from "@/components/Teacher/VideoLibraryManager";
import CoursesTab from "@/components/Teacher/CoursesTab";
import ProfileTab from "@/components/Shared/ProfileTab";
import styles from "./TeacherDashboard.module.css";
import { Loader2 } from "lucide-react";
import PasswordManager from "@/components/Shared/PasswordManager";
import PaymentsManager from "@/components/Admin/PaymentsManager";

interface TeacherStats {
    totalCourses: number;
    totalStudents: number;
    totalEnrollments: number;
    totalLessonsCompleted: number;
    courseProgress: any[];
    aggregateProgress: number;
}

function TeacherDashboardContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const activeTab = (searchParams.get("tab") as any) || "overview";

    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const fetchStats = useCallback(async () => {
        if (!user) return;
        setStatsLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/teacher/stats", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (response.ok) {
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch teacher stats:", error);
        } finally {
            setStatsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
        if (user) {
            fetchStats();
        }
    }, [user, loading, router, fetchStats]);

    if (loading || !user) {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Authenticating Instructor...</span>
            </div>
        );
    }

    return (
        <div className={styles.stack}>
            {activeTab === "overview" && (
                <>
                    {statsLoading ? (
                        <div className={styles.loader}>Syncing performance data...</div>
                    ) : (
                        <TeacherOverview 
                            totalCourses={stats?.totalCourses || 0}
                            totalStudents={stats?.totalStudents || 0}
                            totalEnrollments={stats?.totalEnrollments || 0}
                            totalLessonsCompleted={stats?.totalLessonsCompleted || 0}
                            courseProgress={stats?.courseProgress || []}
                            aggregateProgress={stats?.aggregateProgress || 0}
                            teacherName={user.user_metadata?.full_name || "Teacher"}
                            onTabChange={setActiveTab}
                        />
                    )}
                </>
            )}

            {activeTab === "courses" && (
                <CoursesTab />
            )}

            {activeTab === "library" && (
                <section className={styles.panelNoPad}>
                    <VideoLibraryManager />
                </section>
            )}

            {activeTab === "security" && (
                <PasswordManager />
            )}

            {activeTab === "profile" && (
                <ProfileTab />
            )}

            {activeTab === "payments" && user?.user_metadata?.canManagePayments && (
                <section className={styles.panelNoPad}>
                    <PaymentsManager />
                </section>
            )}
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Teacher Dashboard...</div>}>
            <TeacherDashboardContent />
        </Suspense>
    );
}
