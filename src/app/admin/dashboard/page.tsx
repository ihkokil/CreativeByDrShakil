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
    LayoutGrid,
    Smartphone,
    Inbox,
    BarChart3,
    CreditCard,
    CheckCircle,
    Clock,
    AlertCircle,
    Search
} from 'lucide-react';
import PasswordManager from "@/components/Shared/PasswordManager";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import EditTeacherModal from "@/components/Admin/EditTeacherModal";
import DeleteTeacherModal from "@/components/Admin/DeleteTeacherModal";
import AddStudentToCourseModal from "@/components/Admin/AddStudentToCourseModal";
import CouponManager from "@/components/Admin/CouponManager";
import Image from "next/image";
import SessionsManager from "@/components/Admin/SessionsManager";
import ContactRequestsManager from "@/components/Admin/ContactRequestsManager";
import CategoryManager from "@/components/Admin/CategoryManager";
import StudentsList from "@/components/Admin/StudentsList";
import BkashSettings from "@/components/Admin/BkashSettings";
import AdminOverview from "@/components/Admin/AdminOverview";
import PaymentsManager from "@/components/Admin/PaymentsManager";
import ProfileTab from "@/components/Shared/ProfileTab";
import styles from "./AdminDashboard.module.css";

interface TeacherProfile {
    id: string;
    full_name: string;
    role: string;
    created_at: string;
    email: string;
    designation?: string | null;
    institution?: string | null;
    degrees?: string | null;
    profile_image?: string | null;
    canManagePayments?: boolean;
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
    
    const activeTab = (searchParams.get("tab") as "overview" | "students" | "teachers" | "courses" | "categories" | "payments" | "coupons" | "sessions" | "support" | "settings" | "security" | "profile") || "overview";

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

    const [isAddStudentToCourseOpen, setIsAddStudentToCourseOpen] = useState(false);
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [coursesList, setCoursesList] = useState<any[]>([]);
    const [enrollmentsLoading, setEnrollmentsLoading] = useState(true);

    const [orders, setOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

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

    const toggleSpecialTeacher = async (teacher: TeacherProfile) => {
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/admin/teachers/${teacher.id}/special`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ canManagePayments: !teacher.canManagePayments }),
            });
            if (response.ok) {
                fetchTeachers();
            } else {
                const d = await response.json();
                alert(d.error || "Failed to update teacher status.");
            }
        } catch (err) {
            alert("Network error.");
        }
    };

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

    const fetchOrders = useCallback(async (status: string) => {
        setOrdersLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/admin/orders?status=${status}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (response.ok && Array.isArray(data.orders)) {
                setOrders(data.orders);
            }
        } catch (error) {
            console.error("Failed to fetch orders:", error);
        } finally {
            setOrdersLoading(false);
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

    const handleOrderDecision = async (orderId: string, decision: 'approve' | 'reject') => {
        if (!confirm(`Are you sure you want to ${decision} this payment?`)) return;
        
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/admin/orders/${orderId}/decision`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ decision }),
            });
            if (response.ok) {
                fetchOrders(paymentStatus);
                fetchStats();
            } else {
                const d = await response.json();
                alert(d.error || `Failed to ${decision} payment.`);
            }
        } catch (err) {
            alert("Network error.");
        }
    };

    const getInitials = (name: string) => {
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    };

    const fetchEnrollments = useCallback(async () => {
        setEnrollmentsLoading(true);
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/admin/enrollments", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (response.ok && Array.isArray(data.enrollments)) {
            setEnrollments(data.enrollments);
        } else {
            setEnrollments([]);
        }
        setEnrollmentsLoading(false);
    }, []);

    const fetchCoursesList = useCallback(async () => {
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/admin/courses", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();

        if (response.ok && Array.isArray(data.courses)) {
            setCoursesList(data.courses);
        } else {
            setCoursesList([]);
        }
    }, []);

    useEffect(() => {
        if (user && role === "admin") {
            fetchEnrollments();
            fetchCoursesList();
        }
        if (user && role === "admin" && activeTab === "payments") {
            fetchOrders(paymentStatus);
        }
    }, [user, role, activeTab, paymentStatus, fetchEnrollments, fetchCoursesList, fetchOrders]);
    
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
                            <UserPlus size={16} /> Invite Instructor
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
                            <h2>Quick Actions</h2>
                            <button className={styles.primaryBtn} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                                <UserPlus size={16} /> Add Teacher
                            </button>
                        </div>
                        <div className={styles.actionGrid}>
                            <article className={styles.actionCard} onClick={() => { setActiveTab("courses"); setIsAddStudentToCourseOpen(true); }}>
                                <GraduationCap size={18} />
                                <div><h3>Enroll Student</h3><p>Add student to any course.</p></div>
                            </article>
                            <article className={styles.actionCard} onClick={() => { setActiveTab("teachers"); setIsAddTeacherOpen(true); }}>
                                <UserPlus size={18} />
                                <div><h3>Invite Teacher</h3><p>Send onboarding invite with role setup.</p></div>
                            </article>
                            <article className={styles.actionCard} onClick={() => setActiveTab("teachers")}>
                                <Users size={18} />
                                <div><h3>Manage Instructors</h3><p>Review teacher status and access.</p></div>
                            </article>
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "teachers" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Instructor Directory</h2>
                            <p className={styles.subtitle}>Instructor access control and management</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => setIsAddTeacherOpen(true)}>
                            <UserPlus size={16} /> Add Teacher
                        </button>
                    </div>

                    {teachersLoading ? (
                        <div className={styles.loader}>Synchronizing instructor database...</div>
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
                                                {teacher.canManagePayments && <span className={styles.rolePill} style={{width: "max-content", marginLeft: "4px", background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)"}}>Payment Admin</span>}
                                            </div>
                                            <div className={styles.cardActions}>
                                                <button className={`${styles.actionBtn} ${teacher.canManagePayments ? styles.active : ''}`} onClick={() => toggleSpecialTeacher(teacher)} title={teacher.canManagePayments ? "Revoke Payment Access" : "Grant Payment Access"}><CreditCard size={16} /></button>
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
                        <div className={styles.infoBox}>No instructors found.</div>
                    )}
                </section>
            )}

            {activeTab === "students" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Student Directory</h2>
                            <p className={styles.subtitle}>Enrolled students and user accounts</p>
                        </div>
                    </div>
                    <StudentsList />
                </section>
            )}

            {activeTab === "courses" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <h2>Course Enrollments</h2>
                        <button className={styles.primaryBtn} onClick={() => setIsAddStudentToCourseOpen(true)}>
                            <GraduationCap size={16} /> Add Student to Course
                        </button>
                    </div>

                    {enrollmentsLoading ? (
                        <div className={styles.infoBox}>Loading enrollments...</div>
                    ) : enrollments.length > 0 ? (
                        <div className={styles.teacherList}>
                            {enrollments.map((enrollment) => (
                                <article key={enrollment.id} className={styles.listRow}>
                                    <div className={styles.teacherHead}>
                                        <div className={styles.avatar}>
                                            {enrollment.student.fullName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className={styles.listCol}>
                                            <h3>{enrollment.student.fullName}</h3>
                                            <p>{enrollment.student.email}</p>
                                        </div>
                                    </div>
                                    
                                    <div className={styles.listCol}>
                                        <p style={{ color: "var(--foreground)", fontWeight: 500 }}>
                                            {enrollment.course.title}
                                        </p>
                                    </div>

                                    <div className={styles.listCol}>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                            Enrolled {new Date(enrollment.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className={styles.infoBox}>No enrollments yet.</div>
                    )}
                </section>
            )}

            {activeTab === "categories" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Course Categories</h2>
                    <CategoryManager />
                </section>
            )}

            {activeTab === "payments" && (
                <PaymentsManager />
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

            {activeTab === "security" && (
                <PasswordManager />
            )}

            {activeTab === "profile" && (
                <ProfileTab />
            )}

            <AddTeacherModal
                isOpen={isAddTeacherOpen}
                onClose={() => setIsAddTeacherOpen(false)}
                onSuccess={() => {
                    setIsAddTeacherOpen(false);
                    fetchTeachers();
                }}
            />

            <AddStudentToCourseModal
                isOpen={isAddStudentToCourseOpen}
                onClose={() => setIsAddStudentToCourseOpen(false)}
                onSuccess={() => {
                    setIsAddStudentToCourseOpen(false);
                    fetchEnrollments();
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
