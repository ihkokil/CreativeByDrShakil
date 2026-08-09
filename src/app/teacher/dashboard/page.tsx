"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState, Suspense } from "react";
import TeacherOverview from "@/components/Teacher/TeacherOverview";
import ModuleLibraryManager from "@/components/Teacher/ModuleLibraryManager";
import CoursesTab from "@/components/Teacher/CoursesTab";
import ProfileTab from "@/components/Shared/ProfileTab";
import styles from "./TeacherDashboard.module.css";
import { Loader2 } from "lucide-react";
import PasswordManager from "@/components/Shared/PasswordManager";
import PaymentsManager from "@/components/Admin/PaymentsManager";
import Loader from "@/components/UI/Loader";
import UsersManager from "@/components/Shared/UsersManager";
import StudentsManager from "@/components/Shared/StudentsManager";

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

    // Redirect legacy ?tab=[slug] query parameters to sub-routes
    useEffect(() => {
        const tabParam = searchParams.get("tab");
        if (tabParam) {
            if (tabParam === "overview") {
                router.replace("/teacher/dashboard");
            } else {
                router.replace(`/teacher/dashboard/${tabParam}`);
            }
        }
    }, [searchParams, router]);

    const [stats, setStats] = useState<TeacherStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const setActiveTab = (tab: string) => {
        if (tab === "overview") {
            router.push("/teacher/dashboard");
        } else {
            router.push(`/teacher/dashboard/${tab}`);
        }
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
        return <Loader text="Authenticating Instructor..." />;
    }

    return (
        <div className={styles.stack}>
            {statsLoading ? (
                <Loader text="Syncing performance data..." fullScreen={false} />
            ) : (
                <TeacherOverview 
                    totalCourses={stats?.totalCourses || 0}
                    totalStudents={stats?.totalStudents || 0}
                    totalEnrollments={stats?.totalEnrollments || 0}
                    courseProgress={stats?.courseProgress || []}
                    aggregateProgress={stats?.aggregateProgress || 0}
                    teacherName={user.user_metadata?.full_name || "Teacher"}
                    onTabChange={setActiveTab}
                />
            )}
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <Suspense fallback={<Loader text="Loading dashboard..." />}>
            <TeacherDashboardContent />
        </Suspense>
    );
}
