"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import StudentSidebar from "@/components/Student/StudentSidebar";
import StudentHeader from "@/components/Student/StudentHeader";
import styles from "./StudentDashboard.module.css";
import { Loader2, LayoutDashboard, UserCog, TrendingUp, ClipboardList, BookOpen, MoreHorizontal, ShieldCheck, ReceiptText } from "lucide-react";
import Loader from "@/components/UI/Loader";

function StudentDashboardLayoutContent({
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
        if (pathname === "/dashboard") return "overview";
        if (pathname.startsWith("/dashboard/courses")) return "courses";
        if (pathname.startsWith("/dashboard/purchases") || pathname.startsWith("/dashboard/orders")) return "purchases";
        if (pathname.startsWith("/dashboard/quizzes")) return "quizzes";
        if (pathname.startsWith("/dashboard/profile")) return "profile";
        if (pathname.startsWith("/dashboard/security")) return "security";
        return "overview";
    })();

    const pageTitle = (() => {
        if (pathname === "/dashboard") return "Learning Dashboard";
        if (pathname.startsWith("/dashboard/courses")) return "Enrolled Courses";
        if (pathname.startsWith("/dashboard/purchases") || pathname.startsWith("/dashboard/orders")) return "Orders & Receipts";
        if (pathname.startsWith("/dashboard/quizzes")) return "My Quizzes & Exams";
        if (pathname.startsWith("/dashboard/profile")) return "Profile Settings";
        if (pathname.startsWith("/dashboard/security")) return "Security & Sessions";
        return "Learning Center";
    })();

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

    const mobileNavItems = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'courses', label: 'Courses', icon: BookOpen },
        { id: 'purchases', label: 'Payments', icon: ReceiptText },
        { id: 'quizzes', label: 'Quizzes', icon: ClipboardList },
        { id: 'profile', label: 'Profile', icon: UserCog },
        { id: 'security', label: 'Security', icon: ShieldCheck },
    ];

    if (loading || !user) {
        return <Loader text="Entering Learning Hub..." />;
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
            {isSidebarExpanded && (
                <div 
                    className={styles.sidebarBackdrop} 
                    onClick={() => setIsSidebarExpanded(false)} 
                />
            )}
            
            <main className={`${styles.mainContent} ${!isSidebarExpanded ? styles.mainContentCollapsed : ''}`}>
                <StudentHeader 
                    title={pageTitle}
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

export default function StudentDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<Loader text="Preparing Student Workspace..." />}>
            <StudentDashboardLayoutContent>
                {children}
            </StudentDashboardLayoutContent>
        </Suspense>
    );
}
