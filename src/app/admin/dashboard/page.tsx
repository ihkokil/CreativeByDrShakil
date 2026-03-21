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
    Loader2,
    Search
} from "lucide-react";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import EditTeacherModal from "@/components/Admin/EditTeacherModal";
import DeleteTeacherModal from "@/components/Admin/DeleteTeacherModal";
import CouponManager from "@/components/Admin/CouponManager";
import Image from "next/image";
import SessionsManager from "@/components/Admin/SessionsManager";
import AdminOverview from "@/components/Admin/AdminOverview";

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

export default function AdminDashboard() {
    const { user, loading, role, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [editTeacherData, setEditTeacherData] = useState<TeacherProfile | null>(null);
    const [deleteTeacherData, setDeleteTeacherData] = useState<TeacherProfile | null>(null);
    
    const activeTab = (searchParams.get("tab") as "overview" | "teachers" | "coupons" | "sessions" | "analytics" | "settings") || "overview";

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);

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

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
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
            if (res.ok) alert(data.message || "Email dispatched!");
            else alert(data.error || "Failed to send reset email.");
        } catch(e) {
            alert("Network error.");
        }
    };

    if (loading || !user || role !== "admin") {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Redirecting...</span>
            </div>
        );
    }

    return (
        <div className={styles.stack}>
            {activeTab === "overview" && (
                <>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h1 className={styles.sectionTitle}>Dashboard Overview</h1>
                            <p className={styles.subtitle}>Welcome back, {user.user_metadata?.full_name || 'Admin'}</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                            <UserPlus size={16} /> New Teacher
                        </button>
                    </div>

                    <AdminOverview 
                        teacherCount={teachers.length}
                        studentCount={842}
                        courseCount={24}
                        totalRevenue="৳5,25,000"
                        onTabChange={setActiveTab}
                    />
                </>
            )}

            {activeTab === "teachers" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Teacher Directory</h2>
                            <p className={styles.subtitle}>Manage faculty access and profiles</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => setIsAddTeacherOpen(true)}>
                            <UserPlus size={16} /> Add Teacher
                        </button>
                    </div>

                    {teachersLoading ? (
                        <div className={styles.loader}>Analyzing faculty database...</div>
                    ) : teachers.length > 0 ? (
                        <div className={styles.teacherGrid}>
                            {teachers.map((teacher) => (
                                <article key={teacher.id} className={styles.teacherCard}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardAvatar}>
                                            {teacher.profile_image ? (
                                                <Image src={teacher.profile_image} alt={teacher.full_name} fill style={{ objectFit: 'cover' }} unoptimized/>
                                            ) : getInitials(teacher.full_name || "T")}
                                        </div>
                                        <div className={styles.cardInfo}>
                                            <h3>{teacher.full_name}</h3>
                                            <p>{teacher.email || "Email pending"}</p>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.cardContent}>
                                        <div className={styles.academicInfo}>
                                            {(teacher.designation || teacher.institution) ? (
                                                <p>{teacher.designation} {teacher.designation && teacher.institution ? 'at' : ''} {teacher.institution}</p>
                                            ) : (
                                                <p className={styles.empty}>No academic info</p>
                                            )}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <span className={styles.roleTag}>{teacher.role}</span>
                                            <div className={styles.cardActions}>
                                                <button className={styles.actionBtn} onClick={() => handleResetPassword(teacher)} title="Reset Password"><MailCheck size={16} /></button>
                                                <button className={styles.actionBtn} onClick={() => setEditTeacherData(teacher)} title="Edit Profile"><Edit size={16} /></button>
                                                <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setDeleteTeacherData(teacher)} title="Deactivate"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.infoBox}>No teachers found in the system.</div>
                    )}
                </section>
            )}

            {activeTab === "analytics" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Platform Performance</h2>
                    <div className={styles.simpleCards}>
                        <div className={styles.simpleCard}><strong>74%</strong><span>DAU Engagement</span></div>
                        <div className={styles.simpleCard}><strong>4.8</strong><span>Content Rating</span></div>
                        <div className={styles.simpleCard}><strong>+12%</strong><span>Yield Growth</span></div>
                    </div>
                </section>
            )}

            {activeTab === "coupons" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Marketplace Incentives</h2>
                    <CouponManager />
                </section>
            )}

            {activeTab === "sessions" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Network Security</h2>
                    <SessionsManager />
                </section>
            )}

            {activeTab === "settings" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Core Configurations</h2>
                    <div className={styles.settingGrid}>
                        <article className={styles.settingCard}>
                            <div className={styles.settingIcon}><Shield size={24} /></div>
                            <div><h3>Security Scopes</h3><p>Configure global access tiers and RBAC.</p></div>
                        </article>
                        <article className={styles.settingCard}>
                            <div className={styles.settingIcon}><Search size={24} /></div>
                            <div><h3>Branding Library</h3><p>Control visual identity and platform metadata.</p></div>
                        </article>
                    </div>
                </section>
            )}

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
        </div>
    );
}
