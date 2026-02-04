"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import TeacherCourseBuilder from "@/components/Teacher/TeacherCourseBuilder";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    LayoutDashboard,
    BookOpen,
    Video,
    Users,
    ClipboardList,
    UserCog,
} from "lucide-react";
import styles from "./CreateCoursePage.module.css";

export default function TeacherCreateCoursePage() {
    const { user, loading, role, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || role !== "teacher")) {
            router.push("/");
        }
    }, [loading, role, router, user]);

    const navItems = useMemo(
        () => [
            { key: "overview", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
            { key: "courses", label: "Courses", icon: BookOpen, mobilePrimary: true },
            { key: "students", label: "Students", icon: Users, mobilePrimary: true },
            { key: "assignments", label: "Assignments", icon: ClipboardList },
            { key: "library", label: "Library", icon: Video },
            { key: "user", label: "User Page", icon: UserCog },
        ],
        []
    );

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    if (loading || !user || role !== "teacher") {
        return <div className={styles.loader}>Loading course builder...</div>;
    }

    const teacherName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Teacher";

    return (
        <DashboardShell
            title="Teacher Course Builder"
            subtitle="Create courses, import starter topics, and schedule group-wise content release."
            roleLabel="Teacher"
            userName={teacherName}
            userEmail={user.email}
            userAvatarUrl={user.user_metadata?.profile_image || null}
            items={navItems}
            activeKey="courses"
            onSelect={(key) => {
                if (key === "user") {
                    router.push("/teacher/dashboard/user");
                    return;
                }
                router.push(`/teacher/dashboard?tab=${key}`);
            }}
            onLogout={handleLogout}
        >
            <TeacherCourseBuilder />
        </DashboardShell>
    );
}
