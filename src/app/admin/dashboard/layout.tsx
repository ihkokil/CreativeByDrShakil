"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import AdminSidebar from "@/components/Admin/AdminSidebar";
import AdminHeader from "@/components/Admin/AdminHeader";
import styles from "./AdminDashboard.module.css";
import {
    BarChart3,
    CreditCard,
    GraduationCap,
    Inbox,
    LayoutDashboard,
    LayoutGrid,
    Loader2,
    MoreHorizontal,
    Smartphone,
    TicketPercent,
    Users,
} from "lucide-react";
import Loader from "@/components/UI/Loader";

function AdminDashboardLayoutContent({
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

    const activeTab = (searchParams.get("tab") as any) || "overview";

    useEffect(() => {
        if (!loading && (!user || role !== "admin")) {
            router.push("/");
        }
    }, [user, loading, role, router]);

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`/admin/dashboard?${params.toString()}`);
    };

    const mobileNavItems = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'students', label: 'Students', icon: GraduationCap },
        { id: 'teachers', label: 'Teachers', icon: Users },
        { id: 'payments', label: 'Payments', icon: CreditCard },
        { id: 'support', label: 'Inbox', icon: Inbox },
    ];

    if (loading || !user || role !== "admin") {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Authenticating Admin...</span>
            </div>
        );
    }

    return (
        <div className={styles.dashboardContainer}>
            <AdminSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab as any}
                adminName={user.user_metadata?.full_name || "Admin"}
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
                <AdminHeader 
                    title="Control Center"
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

export default function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<Loader text="Loading Admin Portal..." />}>
            <AdminDashboardLayoutContent>
                {children}
            </AdminDashboardLayoutContent>
        </Suspense>
    );
}
