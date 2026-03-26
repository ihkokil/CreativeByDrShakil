"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useCallback, useState, Suspense } from "react";
import {
    LayoutDashboard,
    Users,
    Settings,
    TicketPercent,
    UserPlus,
    BookOpen,
    GraduationCap,
    Shield,
    Edit,
    Trash2,
    MailCheck,
    Loader2,
    Search,
    LayoutGrid,
    Inbox
} from "lucide-react";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import EditTeacherModal from "@/components/Admin/EditTeacherModal";
import DeleteTeacherModal from "@/components/Admin/DeleteTeacherModal";
import CouponManager from "@/components/Admin/CouponManager";
import Image from "next/image";
import SessionsManager from "@/components/Admin/SessionsManager";
import ContactRequestsManager from "@/components/Admin/ContactRequestsManager";
import CategoryManager from "@/components/Admin/CategoryManager";
import StudentsList from "@/components/Admin/StudentsList";
import BkashSettings from "@/components/Admin/BkashSettings";
import AdminOverview from "@/components/Admin/AdminOverview";
import styles from "./AdminDashboard.module.css";

interface TeacherProfile {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email: string;
    designation?: string;
    institution?: string;
    profile_image?: string | null;
}

interface AdminStats {
    studentCount: number;
    teacherCount: number;
    courseCount: number;
    totalEnrollments: number;
    totalLessonsCompleted: number;
}

function AdminDashboardContent() {
    const { user, loading, role } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [editTeacherData, setEditTeacherData] = useState<TeacherProfile | null>(null);
    const [deleteTeacherData, setDeleteTeacherData] = useState<TeacherProfile | null>(null);
    
    const activeTab = (searchParams.get("tab") as "overview" | "students" | "teachers" | "categories" | "coupons" | "sessions" | "support" | "settings") || "overview";

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [resetConfirmTarget, setResetConfirmTarget] = useState<{id: string; email: string; full_name: string} | null>(null);

    const fetchTeachers = useCallback(async () => {
        setTeachersLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/admin/teachers", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (response.ok && Array.isArray(data.teachers)) {
                setTeachers(data.teachers);
            }
        } catch (error) {
            console.error("Failed to fetch teachers:", error);
        } finally {
            setTeachersLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/admin/stats", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (response.ok) {
                setStats(data);
            }
        } catch (error) {
            console.error("Failed to fetch admin stats:", error);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading && (!user || role !== "admin")) {
            router.push("/");
        }
        if (user && role === "admin") {
            fetchTeachers();
            fetchStats();
        }
    }, [user, role, loading, router, fetchTeachers, fetchStats]);

    const handleResetPassword = (teacher: TeacherProfile) => {
        setResetConfirmTarget({
            id: teacher.id,
            email: teacher.email,
            full_name: teacher.full_name
        });
    };

    const sendResetPassword = async (target: {id: string; email: string}) => {
        setIsSendingReset(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/admin/teachers/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ userId: target.id }),
            });
            if (response.ok) {
                alert("Reset link sent successfully.");
            } else {
                const d = await response.json();
                alert(d.error || "Failed to send reset link.");
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            setIsSendingReset(false);
            setResetConfirmTarget(null);
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    if (loading || !user) {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Authenticating Admin...</span>
            </div>
        );
    }

    return (
        <>
            {activeTab === "overview" && (
                <div className={styles.stack}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h1 className={styles.sectionTitle}>Dashboard Command</h1>
                            <p className={styles.subtitle}>Welcome back, {user.user_metadata?.full_name || 'Administrator'}</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                            <UserPlus size={16} /> Invite Faculty
                        </button>
                    </div>

                    {statsLoading ? (
                        <div className={styles.loader}>Aggregating platform metrics...</div>
                    ) : (
                        <AdminOverview 
                            teacherCount={stats?.teacherCount || 0}
                            studentCount={stats?.studentCount || 0}
                            courseCount={stats?.courseCount || 0}
                            totalEnrollments={stats?.totalEnrollments || 0}
                            totalLessonsCompleted={stats?.totalLessonsCompleted || 0}
                            onTabChange={setActiveTab}
                        />
                    )}

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2>Management Shortcuts</h2>
                        </div>
                        <div className={styles.actionGrid}>
                            <article className={styles.actionCard} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                                <UserPlus size={18} />
                                <div><h3>Faculty Onboarding</h3><p>Invite new medical consultants.</p></div>
                            </article>
                            <article className={styles.actionCard} onClick={() => setActiveTab("students")}>
                                <GraduationCap size={18} />
                                <div><h3>Student Records</h3><p>Manage enrollments and accounts.</p></div>
                            </article>
                            <article className={styles.actionCard} onClick={() => setActiveTab("categories")}>
                                <LayoutGrid size={18} />
                                <div><h3>Global Taxonomy</h3><p>Configure course categories.</p></div>
                            </article>
                            <article className={styles.actionCard} onClick={() => setActiveTab("sessions")}>
                                <Shield size={18} />
                                <div><h3>Security Pulse</h3><p>Monitor active device sessions.</p></div>
                            </article>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "teachers" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Faculty Directory</h2>
                            <p className={styles.subtitle}>Academic access control and management</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => setIsAddTeacherOpen(true)}>
                            <UserPlus size={16} /> Add Teacher
                        </button>
                    </div>

                    {teachersLoading ? (
                        <div className={styles.loader}>Synchronizing faculty database...</div>
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
                                            <p>{teacher.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.cardContent}>
                                        <div className={styles.academicInfo}>
                                            {(teacher.designation || teacher.institution) ? (
                                                <p>{teacher.designation} {teacher.designation && teacher.institution ? 'at' : ''} {teacher.institution}</p>
                                            ) : (
                                                <p className={styles.empty}>No credentials provided</p>
                                            )}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <div className={styles.listCol}>
                                                <span className={styles.rolePill} style={{width: "max-content"}}>{teacher.role}</span>
                                            </div>
                                            <div className={styles.cardActions}>
                                                <button className={styles.actionBtn} onClick={() => handleResetPassword(teacher)} title="Reset Secret"><MailCheck size={16} /></button>
                                                <button className={styles.actionBtn} onClick={() => setEditTeacherData(teacher)} title="Edit Profile"><Edit size={16} /></button>
                                                <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setDeleteTeacherData(teacher)} title="Revoke Access"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.infoBox}>Zero faculty members found.</div>
                    )}
                </section>
            )}

            {activeTab === "students" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Student Directory</h2>
                            <p className={styles.subtitle}>Enrolled scholars and user accounts</p>
                        </div>
                    </div>
                    <StudentsList />
                </section>
            )}

            {activeTab === "categories" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Academic Categories</h2>
                    <CategoryManager />
                </section>
            )}

            {activeTab === "coupons" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Promotion & Coupons</h2>
                    <CouponManager />
                </section>
            )}

            {activeTab === "sessions" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Security Sessions</h2>
                    <SessionsManager />
                </section>
            )}

            {activeTab === "support" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Inbound Help Requests</h2>
                    <ContactRequestsManager />
                </section>
            )}

            {activeTab === "settings" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Platform Financials</h2>
                    <BkashSettings />
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

            {resetConfirmTarget && (
                <div className={styles.confirmBackdrop} role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
                    <div className={styles.confirmDialog}>
                        <h3>Authorize Secret Reset?</h3>
                        <p>
                            This will send a secure reset key to <strong>{resetConfirmTarget.email}</strong>.
                        </p>
                        <div className={styles.confirmActions}>
                            <button className={styles.confirmCancelBtn} onClick={() => setResetConfirmTarget(null)} disabled={isSendingReset}>Cancel</button>
                            <button className={styles.confirmPrimaryBtn} onClick={() => sendResetPassword(resetConfirmTarget)} disabled={isSendingReset}>
                                {isSendingReset ? "Sending Key..." : "Confirm & Send"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default function AdminDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Accessing Admin Authority...</div>}>
            <AdminDashboardContent />
        </Suspense>
    );
}
