"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useMemo, Suspense } from "react";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    ClipboardList,
    Video,
    UserCog,
} from "lucide-react";

function TeacherDashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Determine active key based on pathname or search params
    const activeKey = useMemo(() => {
        if (pathname.includes("/teacher/dashboard/courses")) return "courses";
        if (pathname.includes("/teacher/dashboard/user")) return "user";
        if (pathname.includes("/teacher/dashboard/library")) return "library";
        
        // Fallback to tab search param or overview
        return (searchParams.get("tab") as string) || "overview";
    }, [pathname, searchParams]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

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

    const handleSelect = (key: string) => {
        if (key === "user") {
            router.push("/teacher/dashboard/user");
        } else if (key === "overview") {
            router.push("/teacher/dashboard?tab=overview");
        } else if (key === "library") {
            router.push("/teacher/dashboard?tab=library");
        } else if (key === "courses") {
             router.push("/teacher/dashboard?tab=courses");
        } else {
            router.push(`/teacher/dashboard?tab=${key}`);
        }
    };

    if (loading || !user) {
        return (
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                minHeight: '100vh',
                background: 'var(--background)',
                color: 'var(--foreground)'
            }}>
                Loading Teacher Dashboard...
            </div>
        );
    }

    const teacherName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Teacher";

    return (
        <DashboardShell
            title="Teacher Dashboard"
            subtitle="Manage your courses, students, and content library."
            roleLabel="Teacher"
            userName={teacherName}
            userEmail={user.email}
            userAvatarUrl={user.user_metadata?.profile_image || null}
            items={navItems}
            activeKey={activeKey}
            onSelect={handleSelect}
            onLogout={handleLogout}
        >
            {children}
        </DashboardShell>
    );
}

export default function TeacherDashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<div>Loading Layout...</div>}>
            <TeacherDashboardLayoutContent>{children}</TeacherDashboardLayoutContent>
        </Suspense>
    );
}
