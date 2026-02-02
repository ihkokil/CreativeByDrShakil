"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import styles from "./AdminDashboard.module.css";
import {
    LayoutDashboard,
    Users,
    BarChart3,
    Settings,
    TicketPercent,
    UserPlus,
    BookOpen,
    DollarSign,
    GraduationCap,
    Shield,
    Smartphone,
} from "lucide-react";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import CouponManager from "@/components/Admin/CouponManager";
import SessionsManager from "@/components/Admin/SessionsManager";

interface TeacherProfile {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email?: string;
}

export default function AdminDashboard() {
    const { user, loading, role, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "teachers" | "coupons" | "sessions" | "analytics" | "settings">("overview");
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);

    useEffect(() => {
        if (!loading && (!user || role !== "admin")) {
            router.push("/");
        }
    }, [user, loading, role, router]);

    const fetchTeachers = useCallback(async () => {
        setTeachersLoading(true);
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/admin/teachers", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (response.ok && Array.isArray(data.teachers)) {
            setTeachers(data.teachers);
        } else {
            setTeachers([]);
        }
        setTeachersLoading(false);
    }, []);

    useEffect(() => {
        if (user && role === "admin") {
            fetchTeachers();
        }
    }, [user, role, fetchTeachers]);

    const navItems = useMemo(
        () => [
            { key: "overview", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
            { key: "teachers", label: "Teachers", icon: Users, mobilePrimary: true, badge: teachers.length.toString() },
            { key: "coupons", label: "Coupons", icon: TicketPercent, mobilePrimary: true },
            { key: "sessions", label: "Sessions", icon: Smartphone, mobilePrimary: true },
            { key: "analytics", label: "Analytics", icon: BarChart3, mobilePrimary: true },
            { key: "settings", label: "Settings", icon: Settings },
        ],
        [teachers.length]
    );

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    if (loading || !user || role !== "admin") {
        return <div className={styles.loader}>Loading Admin Panel...</div>;
    }

    return (
        <>
            <DashboardShell
                title="Admin Dashboard"
                subtitle="Control teachers, operations, and platform health with one consistent dashboard shell."
                roleLabel="Admin"
                userName={user.user_metadata?.full_name || "Admin"}
                userEmail={user.email}
                userAvatarUrl={user.user_metadata?.profile_image || null}
                items={navItems}
                activeKey={activeTab}
                onSelect={(key) => setActiveTab(key as "overview" | "teachers" | "coupons" | "sessions" | "analytics" | "settings")}
                onLogout={handleLogout}
            >
                {activeTab === "overview" && (
                    <div className={styles.stack}>
                        <section className={styles.metricsGrid}>
                            <div className={styles.metricCard}><Users size={20} /><div><h3>{teachers.length}</h3><p>Teachers</p></div></div>
                            <div className={styles.metricCard}><GraduationCap size={20} /><div><h3>842</h3><p>Students</p></div></div>
                            <div className={styles.metricCard}><BookOpen size={20} /><div><h3>24</h3><p>Courses</p></div></div>
                            <div className={styles.metricCard}><DollarSign size={20} /><div><h3>৳5,25,000</h3><p>Revenue</p></div></div>
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.panelHeader}>
                                <h2>Quick Actions</h2>
                                <button className={styles.primaryBtn} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                                    <UserPlus size={16} /> Add Teacher
                                </button>
                            </div>
                            <div className={styles.actionGrid}>
                                <article className={styles.actionCard} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                                    <UserPlus size={18} />
                                    <div><h3>Invite Teacher</h3><p>Send onboarding invite with role setup.</p></div>
                                </article>
                                <article className={styles.actionCard} onClick={() => setActiveTab("teachers")}>
                                    <Users size={18} />
                                    <div><h3>Manage Faculty</h3><p>Review teacher status and access.</p></div>
                                </article>
                                <article className={styles.actionCard} onClick={() => setActiveTab("analytics")}>
                                    <BarChart3 size={18} />
                                    <div><h3>View Analytics</h3><p>Track growth, engagement, and revenue.</p></div>
                                </article>
                                <article className={styles.actionCard} onClick={() => setActiveTab("settings")}>
                                    <Shield size={18} />
                                    <div><h3>Security</h3><p>Review permissions and controls.</p></div>
                                </article>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === "teachers" && (
                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2>Teacher Accounts</h2>
                            <button className={styles.primaryBtn} onClick={() => setIsAddTeacherOpen(true)}>
                                <UserPlus size={16} /> Add Teacher
                            </button>
                        </div>

                        {teachersLoading ? (
                            <div className={styles.infoBox}>Loading teachers...</div>
                        ) : teachers.length > 0 ? (
                            <div className={styles.teacherGrid}>
                                {teachers.map((teacher) => (
                                    <article key={teacher.id} className={styles.teacherCard}>
                                        <div className={styles.teacherHead}>
                                            <div className={styles.avatar}>{getInitials(teacher.full_name || "T")}</div>
                                            <div>
                                                <h3>{teacher.full_name}</h3>
                                                <p>{teacher.email || "Email pending"}</p>
                                            </div>
                                        </div>
                                        <div className={styles.teacherMeta}>
                                            <span className={styles.rolePill}>{teacher.role}</span>
                                            <span>Joined {new Date(teacher.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className={styles.infoBox}>No teachers added yet.</div>
                        )}
                    </section>
                )}

                {activeTab === "analytics" && (
                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>Analytics Snapshot</h2>
                        <div className={styles.simpleCards}>
                            <div className={styles.simpleCard}><strong>74%</strong><span>Weekly Active Users</span></div>
                            <div className={styles.simpleCard}><strong>4.8</strong><span>Average Course Rating</span></div>
                            <div className={styles.simpleCard}><strong>+12%</strong><span>Monthly Revenue Growth</span></div>
                        </div>
                    </section>
                )}

                {activeTab === "coupons" && (
                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>Coupon Management</h2>
                        <CouponManager />
                    </section>
                )}
                {activeTab === "sessions" && (
                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>Device Sessions</h2>
                        <SessionsManager />
                    </section>
                )}
                {activeTab === "settings" && (
                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>Platform Settings</h2>
                        <div className={styles.settingCards}>
                            <article className={styles.settingCard}><h3>Email Templates</h3><p>Configure onboarding and notification templates.</p></article>
                            <article className={styles.settingCard}><h3>Roles & Access</h3><p>Manage admin/teacher permissions and scopes.</p></article>
                            <article className={styles.settingCard}><h3>Branding</h3><p>Control logo, colors, and platform metadata.</p></article>
                        </div>
                    </section>
                )}
            </DashboardShell>

            <AddTeacherModal
                isOpen={isAddTeacherOpen}
                onClose={() => setIsAddTeacherOpen(false)}
                onSuccess={() => {
                    setIsAddTeacherOpen(false);
                    fetchTeachers();
                }}
            />
        </>
    );
}
