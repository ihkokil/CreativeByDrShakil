"use client";

import { useEffect, useCallback, useState, Suspense } from "react";
import {
    Users,
    UserPlus,
    Edit,
    Trash2,
    MailCheck,
    CreditCard,
} from 'lucide-react';
import Image from "next/image";
import AddTeacherModal from "@/components/Admin/AddTeacherModal";
import EditTeacherModal from "@/components/Admin/EditTeacherModal";
import DeleteTeacherModal from "@/components/Admin/DeleteTeacherModal";
import styles from "../AdminDashboard.module.css";
import { useAuth } from "@/context/AuthContext";

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

function TeachersPageContent() {
    const { user, role } = useAuth();
    const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
    const [editTeacherData, setEditTeacherData] = useState<TeacherProfile | null>(null);
    const [deleteTeacherData, setDeleteTeacherData] = useState<TeacherProfile | null>(null);
    const [resetConfirmTarget, setResetConfirmTarget] = useState<{id: string; email: string; full_name: string} | null>(null);
    
    const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
    const [teachersLoading, setTeachersLoading] = useState(true);
    const [isSendingReset, setIsSendingReset] = useState(false);

    const fetchTeachers = useCallback(async () => {
        setTeachersLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/admin/teachers", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = (await response.json()) as any;
            if (response.ok && Array.isArray(data?.teachers)) {
                setTeachers(data.teachers);
            }
        } catch (error) {
            console.error("Failed to fetch teachers:", error);
        } finally {
            setTeachersLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user && role === "admin") {
            fetchTeachers();
        }
    }, [user, role, fetchTeachers]);

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
                const d = (await response.json()) as any;
                alert(d?.error || "Failed to update teacher status.");
            }
        } catch (err) {
            alert("Network error.");
        }
    };

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
                const d = (await response.json()) as any;
                alert(d?.error || "Failed to send reset link.");
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            setIsSendingReset(false);
            setResetConfirmTarget(null);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return 'TR';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
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
                                    </div>
                                    <div className={styles.cardActions}>
                                        <button 
                                            className={`${styles.actionBtn} ${teacher.canManagePayments ? styles.success : ''}`} 
                                            onClick={() => toggleSpecialTeacher(teacher)} 
                                            title={teacher.canManagePayments ? "Revoke Payment Access" : "Grant Payment Access"}
                                        >
                                            <CreditCard size={16} />
                                        </button>
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
        </section>
    );
}

export default function TeachersPage() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Instructors...</div>}>
            <TeachersPageContent />
        </Suspense>
    );
}
