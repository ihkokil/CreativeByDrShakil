"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
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
    Edit,
    Trash2,
    MailCheck,
    Smartphone,
} from "lucide-react";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import EditTeacherModal from "@/components/Admin/EditTeacherModal";
import DeleteTeacherModal from "@/components/Admin/DeleteTeacherModal";
import CouponManager from "@/components/Admin/CouponManager";
import Image from "next/image";
import SessionsManager from "@/components/Admin/SessionsManager";

interface TeacherProfile {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email: string;
    designation?: string;
    institution?: string;
    degrees?: string;
    profile_image?: string;
}

type ToastState = {
    type: "success" | "error" | "info";
    text: string;
} | null;

function AdminDashboardContent() {
    const { user, loading, role, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [editTeacherData, setEditTeacherData] = useState<TeacherProfile | null>(null);
    const [deleteTeacherData, setDeleteTeacherData] = useState<TeacherProfile | null>(null);
    
    // Instead of useState for activeTab, derive it from searchParams
    const activeTab = (searchParams.get("tab") as "overview" | "teachers" | "coupons" | "sessions" | "analytics" | "settings") || "overview";

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);
    const [toast, setToast] = useState<ToastState>(null);

    useEffect(() => {
        if (!toast) return;
        const timer = window.setTimeout(() => setToast(null), 3200);
        return () => window.clearTimeout(timer);
    }, [toast]);

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
        router.replace("/");
        router.refresh();
    };

    const handleResetPassword = async (teacher: TeacherProfile) => {
        const confirmContent = window.confirm(`Send password reset email to ${teacher.email}?`);
        if (!confirmContent) return;

        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch(`/api/admin/teachers/${teacher.id}/reset-password`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (res.ok) {
                setToast({ type: "success", text: data.message || "Password reset link dispatched." });
            } else {
                setToast({ type: "error", text: data.error || "Failed to send reset email." });
            }
        } catch(e) {
            setToast({ type: "error", text: "Network error while sending reset email." });
        }
    };

    if (loading || !user || role !== "admin") {
        return <div className={styles.loader}>Loading Admin Panel...</div>;
    }

    return (
        <>
            {toast && (
                <div className={styles.toastWrap} role="status" aria-live="polite">
                    <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : toast.type === "error" ? styles.toastError : styles.toastInfo}`}>
                        {toast.text}
                    </div>
                </div>
            )}

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
                            <div className={styles.teacherList}>
                                {teachers.map((teacher) => (
                                    <article key={teacher.id} className={styles.listRow}>
                                        <div className={styles.teacherHead}>
                                            <div className={styles.avatar} style={{ overflow: "hidden", position: "relative" }}>
                                                {teacher.profile_image ? (
                                                    <Image src={teacher.profile_image} alt={teacher.full_name} fill style={{ objectFit: 'cover' }} unoptimized/>
                                                ) : getInitials(teacher.full_name || "T")}
                                            </div>
                                            <div className={styles.listCol}>
                                                <h3>{teacher.full_name}</h3>
                                                <p>{teacher.email || "Email pending"}</p>
                                            </div>
                                        </div>
                                        
                                        <div className={styles.listCol}>
                                            {(teacher.designation || teacher.institution || teacher.degrees) ? (
                                                <>
                                                    <p style={{ color: "var(--foreground)", fontWeight: 500 }}>
                                                        {teacher.designation} {teacher.designation && teacher.institution ? "at" : ""} {teacher.institution}
                                                    </p>
                                                    {teacher.degrees && <span style={{ color: "var(--primary)", fontSize: "0.8rem", fontWeight: 700 }}>{teacher.degrees}</span>}
                                                </>
                                            ) : (
                                                <p style={{fontStyle: "italic"}}>No academic details</p>
                                            )}
                                        </div>

                                        <div className={styles.listCol}>
                                            <span className={styles.rolePill} style={{width: "max-content"}}>{teacher.role}</span>
                                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                                Joined {new Date(teacher.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        <div className={styles.actionGroup}>
                                            <button className={styles.iconBtn} title="Send Reset Mail" onClick={() => handleResetPassword(teacher)}>
                                                <MailCheck size={16} />
                                            </button>
                                            <button className={styles.iconBtn} title="Edit Teacher" onClick={() => setEditTeacherData(teacher)}>
                                                <Edit size={16} />
                                            </button>
                                            <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete & Reassign" onClick={() => setDeleteTeacherData(teacher)}>
                                                <Trash2 size={16} />
                                            </button>
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

            <EditTeacherModal
                isOpen={!!editTeacherData}
                onClose={() => setEditTeacherData(null)}
                onSuccess={() => fetchTeachers()}
                teacher={editTeacherData}
            />

            <DeleteTeacherModal
                isOpen={!!deleteTeacherData}
                onClose={() => setDeleteTeacherData(null)}
                onSuccess={() => fetchTeachers()}
                teacherTarget={deleteTeacherData}
                allTeachers={teachers}
            />
        </>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Admin Panel...</div>}>
            <AdminDashboardContent />
        </Suspense>
    );
}
