"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Search, Loader2, Edit, Trash2, MailCheck, GraduationCap, X, User, Mail, Phone, FileText, ImagePlus, Send } from "lucide-react";
import dashStyles from "@/app/admin/dashboard/AdminDashboard.module.css";
import localStyles from "./StudentsList.module.css";

interface StudentProfile {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    bmdcNumber?: string;
    role: string;
    created_at: string;
    profile_image?: string;
    emailVerified?: boolean;
}

export default function StudentsList() {
    const [students, setStudents] = useState<StudentProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
    const [deleteStudent, setDeleteStudent] = useState<StudentProfile | null>(null);

    // Form states
    const [formData, setFormData] = useState({ 
        fullName: '', 
        email: '', 
        phone: '', 
        bmdcNumber: '', 
        profileImage: '' 
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
        setMessage(msg);
        setTimeout(() => setMessage(null), 4000);
    };

    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/admin/students", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await res.json();
            if (res.ok && data.students) {
                // The API already maps these fields, but we ensure the interface matches
                const mappedStudents = data.students.map((s: any) => ({
                    id: s.id,
                    full_name: s.full_name,
                    email: s.email,
                    phone: s.phone,
                    bmdcNumber: s.bmdcNumber,
                    role: s.role,
                    created_at: s.created_at,
                    profile_image: s.profile_image,
                    emailVerified: s.emailVerified,
                }));
                setStudents(mappedStudents);
            }
        } catch (err) {
            console.error("Failed to fetch students", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

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
        setMessage(null);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/admin/students/manage", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {} },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            
            if (res.ok) {
                showMessage({ type: 'success', text: data.message || 'Student added and invitation sent.' });
                setTimeout(() => {
                    setIsAddOpen(false);
                    setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' });
                    fetchStudents();
                }, 2000);
            } else {
                showMessage({ type: 'error', text: data.error || 'Failed to add student.' });
            }
        } catch (err) {
            showMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!editStudent) return;
        setIsSubmitting(true);
        setMessage(null);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/admin/students/manage", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...token ? { Authorization: `Bearer ${token}` } : {} },
                body: JSON.stringify({ id: editStudent.id, ...formData })
            });
            const data = await res.json();

            if (res.ok) {
                showMessage({ type: 'success', text: 'Student updated successfully.' });
                setTimeout(() => {
                    setEditStudent(null);
                    fetchStudents();
                }, 1500);
            } else {
                showMessage({ type: 'error', text: data.error || 'Failed to update student.' });
            }
        } catch (err) {
            showMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally { 
            setIsSubmitting(false); 
        }
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

    const handleConfirmEmail = async (student: StudentProfile) => {
        setIsSubmitting(true);
        setMessage(null);
        try {
            const token = localStorage.getItem("auth_token");
            const res = await fetch("/api/admin/students/manage", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ id: student.id, emailVerified: true }),
            });
            const data = await res.json();

            if (res.ok) {
                showMessage({ type: 'success', text: data.message || `${student.full_name}'s email has been confirmed.` });
                fetchStudents();
            } else {
                showMessage({ type: 'error', text: data.error || 'Failed to confirm email.' });
            }
        } catch (err) {
            showMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={localStyles.wrapper}>
            <div className={localStyles.header}>
                <div className={localStyles.searchBar}>
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Search students by name or email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className={dashStyles.primaryBtn} onClick={() => { 
                    setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' }); 
                    setMessage(null);
                    setIsAddOpen(true); 
                }}>
                    <GraduationCap size={16} /> New Student
                </button>
            </div>

            {loading ? (
                <div className={dashStyles.loader}>
                    <Loader2 className={dashStyles.spinner} />
                    Loading students...
                </div>
            ) : filteredStudents.length > 0 ? (
                <div className={dashStyles.teacherGrid}>
                    {filteredStudents.map((student) => (
                        <article key={student.id} className={dashStyles.teacherCard}>
                            <div className={dashStyles.cardHeader}>
                                <div className={dashStyles.cardAvatar}>
                                    {student.profile_image ? (
                                        <Image src={student.profile_image} alt={student.full_name} fill style={{ objectFit: 'cover' }} unoptimized/>
                                    ) : getInitials(student.full_name)}
                                </div>
                                <div className={dashStyles.cardInfo}>
                                    <h3>{student.full_name || "Unknown"}</h3>
                                    <p>{student.email || "No email"}</p>
                                </div>
                            </div>
                            
                            <div className={dashStyles.cardContent}>
                                <div className={dashStyles.academicInfo}>
                                    <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Phone size={14} /> {student.phone || "No phone"}
                                    </p>
                                    {student.bmdcNumber && (
                                        <p style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                            <FileText size={14} /> BM&DC: {student.bmdcNumber}
                                        </p>
                                    )}
                                    <div style={{ marginTop: '8px' }}>
                                        <span
                                            className={dashStyles.rolePill}
                                            style={{
                                                width: 'max-content',
                                                background: student.emailVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                color: student.emailVerified ? '#10b981' : '#f59e0b',
                                            }}
                                        >
                                            {student.emailVerified ? 'Email confirmed' : 'Email unconfirmed'}
                                        </span>
                                    </div>
                                </div>
                                <div className={dashStyles.cardFooter}>
                                    <div className={dashStyles.listCol}>
                                        <span className={dashStyles.rolePill} style={{width: "max-content", background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
                                            {student.role}
                                        </span>
                                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                            Joined {new Date(student.created_at).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <div className={dashStyles.cardActions}>
                                        {!student.emailVerified && (
                                            <button className={dashStyles.actionBtn} onClick={() => handleConfirmEmail(student)} title="Confirm email" disabled={isSubmitting}><MailCheck size={16} /></button>
                                        )}
                                        <button className={dashStyles.actionBtn} onClick={() => { setFormData({ fullName: student.full_name, email: student.email, phone: student.phone || '', bmdcNumber: student.bmdcNumber || '', profileImage: student.profile_image || '' }); setEditStudent(student); setMessage(null); }} title="Edit Profile"><Edit size={16} /></button>
                                        <button className={`${dashStyles.actionBtn} ${dashStyles.danger}`} onClick={() => setDeleteStudent(student)} title="Delete"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className={dashStyles.infoBox}>No students found matching your criteria.</div>
            )}

            {/* ADD MODAL */}
            {isAddOpen && (
                <div className={localStyles.modalBackdrop}>
                    <div className={`${localStyles.modal} glass`}>
                        <div className={localStyles.modalHeader}>
                            <h2>Add New Student</h2>
                            <button onClick={() => setIsAddOpen(false)} className={localStyles.closeBtn}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAdd} className={localStyles.modalBody}>
                            <div className={localStyles.imageUploadWrapper}>
                                <label className={localStyles.imageLabel}>
                                    {formData.profileImage ? (
                                        <img src={formData.profileImage} alt="Preview" className={localStyles.imagePreview} />
                                    ) : (
                                        <div className={localStyles.imagePlaceholder}>
                                            <ImagePlus size={20} />
                                            <span>Upload Photo</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                                </label>
                            </div>

                            <div className={localStyles.formGroup}>
                                <label>Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={localStyles.input} placeholder="e.g. John Doe" style={{ paddingLeft: '40px', width: '100%' }} />
                                </div>
                            </div>
                            <div className={localStyles.formGroup}>
                                <label>Email Address</label>
                                <div style={{ position: 'relative' }}>
                                    <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={localStyles.input} placeholder="student@example.com" style={{ paddingLeft: '40px', width: '100%' }} />
                                </div>
                            </div>
                            <div className={localStyles.row}>
                                <div className={`${localStyles.formGroup} ${localStyles.halfWidth}`}>
                                    <label>Phone</label>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={localStyles.input} placeholder="017..." style={{ paddingLeft: '40px', width: '100%' }} />
                                    </div>
                                </div>
                                <div className={`${localStyles.formGroup} ${localStyles.halfWidth}`}>
                                    <label>BM&DC Number</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={localStyles.input} placeholder="A-12345" style={{ paddingLeft: '40px', width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            {message && (
                                <div className={`${localStyles.message} ${localStyles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button disabled={isSubmitting} type="submit" className={dashStyles.primaryBtn} style={{width: '100%', marginTop: '10px', justifyContent: 'center'}}>
                                {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                                {!isSubmitting && <Send size={16} style={{ marginLeft: '8px' }} />}
                            </button>
                            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                An email will be sent to the student to set their password.
                            </p>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editStudent && (
                <div className={localStyles.modalBackdrop}>
                    <div className={`${localStyles.modal} glass`}>
                        <div className={localStyles.modalHeader}>
                            <h2>Edit Student Profile</h2>
                            <button onClick={() => setEditStudent(null)} className={localStyles.closeBtn}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEdit} className={localStyles.modalBody}>
                            <div className={localStyles.imageUploadWrapper}>
                                <label className={localStyles.imageLabel}>
                                    {formData.profileImage ? (
                                        <img src={formData.profileImage} alt="Preview" className={localStyles.imagePreview} />
                                    ) : (
                                        <div className={localStyles.imagePlaceholder}>
                                            <ImagePlus size={20} />
                                            <span>Upload Photo</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                                </label>
                            </div>

                            <div className={localStyles.formGroup}>
                                <label>Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={localStyles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                                </div>
                            </div>
                            
                            <div className={localStyles.row}>
                                <div className={`${localStyles.formGroup} ${localStyles.halfWidth}`}>
                                    <label>Phone</label>
                                    <div style={{ position: 'relative' }}>
                                        <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={localStyles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                                    </div>
                                </div>
                                <div className={`${localStyles.formGroup} ${localStyles.halfWidth}`}>
                                    <label>BM&DC Number</label>
                                    <div style={{ position: 'relative' }}>
                                        <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={localStyles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                                    </div>
                                </div>
                            </div>

                            {message && (
                                <div className={`${localStyles.message} ${localStyles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button disabled={isSubmitting} type="submit" className={dashStyles.primaryBtn} style={{width: '100%', marginTop: '10px', justifyContent: 'center'}}>
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deleteStudent && (
                <div className={dashStyles.confirmBackdrop} role="dialog">
                    <div className={dashStyles.confirmDialog}>
                        <h3>Delete Student?</h3>
                        <p>Are you sure you want to completely remove <strong>{deleteStudent.full_name}</strong>? This will revoke all course access and delete their history. This action cannot be undone.</p>
                        <div className={dashStyles.confirmActions}>
                            <button className={dashStyles.confirmCancelBtn} onClick={() => setDeleteStudent(null)} disabled={isSubmitting}>Cancel</button>
                            <button className={dashStyles.confirmPrimaryBtn} onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? "Deleting..." : "Permanently Delete"}</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
