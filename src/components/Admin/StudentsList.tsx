"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Search, Loader2, Edit, Trash2, MailCheck, GraduationCap, X } from "lucide-react";
import styles from "@/app/admin/dashboard/AdminDashboard.module.css";
// import AddStudentModal from "./AddStudentModal";
// import EditStudentModal from "./EditStudentModal";
// import DeleteStudentModal from "./DeleteStudentModal";

interface StudentProfile {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    role: string;
    created_at: string;
    profile_image?: string;
}

export default function StudentsList() {
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
    const [deleteStudent, setDeleteStudent] = useState<StudentProfile | null>(null);

    // Form states
    const [formData, setFormData] = useState({ fullName: '', email: '', phone: '', password: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/admin/students", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (res.ok && data.students) {
                setStudents(data.students);
            }
        } catch (err) {
            console.error("Failed to fecth students", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const getInitials = (name: string) => {
        return name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "ST";
    };

    const filteredStudents = students.filter(s => 
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("auth_token");
            await fetch("/api/admin/students/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {} },
                body: JSON.stringify({ fullName: formData.fullName, email: formData.email, phone: formData.phone, password: formData.password })
            });
            setIsAddOpen(false);
            setFormData({ fullName: '', email: '', phone: '', password: '' });
            fetchStudents();
        } finally { setIsSubmitting(false); }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editStudent) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("auth_token");
            await fetch("/api/admin/students/manage", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {} },
                body: JSON.stringify({ id: editStudent.id, fullName: formData.fullName, phone: formData.phone })
            });
            setEditStudent(null);
            fetchStudents();
        } finally { setIsSubmitting(false); }
    };

    const handleDelete = async () => {
        if(!deleteStudent) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem("auth_token");
            await fetch("/api/admin/students/manage", {
                method: "DELETE",
                headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {} },
                body: JSON.stringify({ id: deleteStudent.id })
            });
            setDeleteStudent(null);
            fetchStudents();
        } finally { setIsSubmitting(false); }
    };

    return (
        <div className={styles.categoryManager}>
            <div className={styles.managerHeader}>
                <div className={styles.searchBar}>
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Search students by name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={styles.primaryBtn} onClick={() => { setFormData({ fullName: '', email: '', phone: '', password: '' }); setIsAddOpen(true); }}>
                    <GraduationCap size={16} /> New Student
                </button>
            </div>

            {loading ? (
                <div className={styles.loader}>Loading students...</div>
            ) : filteredStudents.length > 0 ? (
                <div className={styles.teacherGrid}>
                    {filteredStudents.map((student) => (
                        <article key={student.id} className={styles.teacherCard}>
                            <div className={styles.cardHeader}>
                                <div className={styles.cardAvatar}>
                                    {student.profile_image ? (
                                        <Image src={student.profile_image} alt={student.full_name} fill style={{ objectFit: 'cover' }} unoptimized/>
                                    ) : getInitials(student.full_name)}
                                </div>
                                <div className={styles.cardInfo}>
                                    <h3>{student.full_name || "Unknown"}</h3>
                                    <p>{student.email || "No email"}</p>
                                </div>
                            </div>
                            
                            <div className={styles.cardContent}>
                                <div className={styles.academicInfo}>
                                    <p>{student.phone || "No phone number available"}</p>
                                </div>
                                <div className={styles.cardFooter}>
                                    <div className={styles.listCol}>
                                        <span className={styles.rolePill} style={{width: "max-content", background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                                            {student.role}
                                        </span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                            Joined {new Date(student.created_at).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <div className={styles.cardActions}>
                                        <button className={styles.actionBtn} onClick={() => alert('Reset Pass pending')} title="Reset Password"><MailCheck size={16} /></button>
                                        <button className={styles.actionBtn} onClick={() => { setFormData({ fullName: student.full_name, email: student.email, phone: student.phone || '', password: '' }); setEditStudent(student); }} title="Edit Profile"><Edit size={16} /></button>
                                        <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => setDeleteStudent(student)} title="Delete"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className={styles.infoBox}>No students found matching your criteria.</div>
            )}

            {/* ADD MODAL */}
            {isAddOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Add New Student</h2>
                            <button onClick={() => setIsAddOpen(false)} className={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAdd} className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Full Name</label>
                                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Email Address</label>
                                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Temporary Password</label>
                                <input required type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Phone (Optional)</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} />
                            </div>
                            <button disabled={isSubmitting} type="submit" className={styles.primaryBtn} style={{width: '100%', marginTop: '10px'}}>{isSubmitting ? 'Saving...' : 'Add Student'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editStudent && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>Edit Student</h2>
                            <button onClick={() => setEditStudent(null)} className={styles.closeBtn}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEdit} className={styles.modalBody}>
                            <div className={styles.formGroup}>
                                <label>Full Name</label>
                                <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={styles.input} />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Phone (Optional)</label>
                                <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} />
                            </div>
                            <button disabled={isSubmitting} type="submit" className={styles.primaryBtn} style={{width: '100%', marginTop: '10px'}}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deleteStudent && (
                <div className={styles.confirmBackdrop} role="dialog">
                    <div className={styles.confirmDialog}>
                        <h3>Delete Student?</h3>
                        <p>Are you sure you want to completely remove <strong>{deleteStudent.full_name}</strong>? This will revoke all course access and delete their history. This action cannot be undone.</p>
                        <div className={styles.confirmActions}>
                            <button className={styles.confirmCancelBtn} onClick={() => setDeleteStudent(null)} disabled={isSubmitting}>Cancel</button>
                            <button className={styles.confirmPrimaryBtn} onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? "Deleting..." : "Permanently Delete"}</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
