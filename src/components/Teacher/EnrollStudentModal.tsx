"use client";

import { useState, useEffect } from "react";
import styles from "./EnrollStudentModal.module.css";
import Loader from "@/components/UI/Loader";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, User, Mail, Phone, BookOpen, Check, UserPlus, GraduationCap, Users } from "lucide-react";
import { useModalLock } from "@/hooks/useModalLock";

interface Student {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
}

interface Props {
    courseId: string;
    batchId?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EnrollStudentModal({ 
    courseId, 
    batchId,
    isOpen, 
    onClose, 
    onSuccess 
}: Props) {
    useModalLock(isOpen, onClose);
    const [activeTab, setActiveTab] = useState<"existing" | "new" | "bulk">("existing");
    
    // Data states
    const [students, setStudents] = useState<Student[]>([]);
    const [batches, setBatches] = useState<{id: string, name: string, startDate: string}[]>([]);
    
    // Form states
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [selectedBatchId, setSelectedBatchId] = useState<string>(batchId || "");
    const [searchQuery, setSearchQuery] = useState("");
    
    // New student form states
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentPhone, setNewStudentPhone] = useState("");
    
    // Bulk student state
    const [bulkEmailsText, setBulkEmailsText] = useState("");

    // UI states
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Fetch existing students initially and when search query changes
    useEffect(() => {
        if (!isOpen || activeTab !== "existing") return;
        
        const delayDebounceFn = setTimeout(async () => {
            try {
                const token = localStorage.getItem("auth_token");
                const res = await fetch(`/api/teacher/students/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setStudents(data.students || []);
                }
            } catch (err) {
                console.error("Failed to search students", err);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, isOpen, activeTab]);

    useEffect(() => {
        if (isOpen && !batchId) {
            // Fetch batches for this course
            const fetchBatches = async () => {
                try {
                    const res = await fetch(`/api/teacher/batches/${courseId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setBatches(data.batches || []);
                    }
                } catch (err) {
                    console.error("Failed to fetch batches", err);
                }
            };
            fetchBatches();
        }
    }, [isOpen, courseId, batchId]);

    const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
        setMessage(msg);
        setTimeout(() => {
            setMessage(null);
        }, 5000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const token = localStorage.getItem("auth_token");
            const isNewStudent = activeTab === "new";
            
            let requestBody: any;
            
            if (activeTab === "bulk") {
                const bulkEmails = bulkEmailsText
                    .split(/[\n,]/)
                    .map(e => e.trim())
                    .filter(e => e.length > 0);
                    
                if (bulkEmails.length === 0) {
                    showMessage({ type: 'error', text: 'Please enter at least one valid email.' });
                    setLoading(false);
                    return;
                }
                
                requestBody = {
                    courseId,
                    batchId: selectedBatchId || undefined,
                    isNewStudent: false,
                    bulkEmails
                };
            } else if (isNewStudent) {
                requestBody = {
                    courseId,
                    batchId: selectedBatchId || undefined,
                    isNewStudent: true,
                    email: newStudentEmail.trim().toLowerCase(),
                    fullName: newStudentName.trim(),
                    phone: newStudentPhone.trim() || undefined,
                };
            } else {
                requestBody = {
                    courseId,
                    batchId: selectedBatchId || undefined,
                    isNewStudent: false,
                    studentIds: selectedStudents,
                };
            }

            if (isNewStudent && (!newStudentEmail || !newStudentName)) {
                showMessage({ type: 'error', text: 'Email and full name are required for new students.' });
                setLoading(false);
                return;
            }

            if (activeTab === "existing" && selectedStudents.length === 0) {
                showMessage({ type: 'error', text: 'Please select at least one student.' });
                setLoading(false);
                return;
            }

            const response = await fetch("/api/teacher/enrollments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage({ type: 'error', text: data.error || "Failed to enroll student." });
            } else {
                showMessage({ type: 'success', text: data.message || "Student enrolled successfully!" });
                
                // Reset form
                setSelectedStudents([]);
                setNewStudentEmail("");
                setNewStudentName("");
                setNewStudentPhone("");
                setBulkEmailsText("");
                setSearchQuery("");
                
                setTimeout(() => {
                    onSuccess();
                }, 2000);
            }
        } catch (err: any) {
            showMessage({ type: 'error', text: "Network error. Please try again." });
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessage(null);
        setSelectedStudents([]);
        setSearchQuery("");
        setNewStudentEmail("");
        setNewStudentName("");
        setNewStudentPhone("");
        setBulkEmailsText("");
        if (!batchId) setSelectedBatchId("");
        setActiveTab("existing");
        onClose();
    };

    // Filter students client-side if we already loaded them
    const filteredStudents = students.filter(s => 
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery))
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay}>
                    <motion.div
                        className={`${styles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={handleClose} type="button">
                            <X size={20} />
                        </button>

                        <div className={styles.header}>
                            <h2 className={styles.title}>
                                Add Student to <span className="gradient-text">Course</span>
                            </h2>
                            <p className={styles.subtitle}>
                                Enroll an existing student or register a new one to a course.
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className={styles.tabs}>
                            <button
                                type="button"
                                className={`${styles.tab} ${activeTab === "existing" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("existing")}
                            >
                                <User size={16} />
                                Existing
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${activeTab === "new" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("new")}
                            >
                                <UserPlus size={16} />
                                New
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${activeTab === "bulk" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("bulk")}
                            >
                                <Users size={16} />
                                Bulk Add
                            </button>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            {!batchId && (
                                <div className={styles.fieldGroup} style={{ marginBottom: '1rem' }}>
                                    <label className={styles.fieldLabel}>
                                        Select Batch (Optional)
                                    </label>
                                    <select 
                                        className={styles.selectInput}
                                        value={selectedBatchId}
                                        onChange={(e) => setSelectedBatchId(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-color)' }}
                                    >
                                        <option value="">-- No Batch (Enrolls with today's date) --</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.name} (Starts: {new Date(b.startDate).toLocaleDateString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activeTab === "existing" ? (
                                <>
                                    {/* Search for existing student */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>
                                            <Search size={16} />
                                            Search Student
                                        </label>
                                        <div className={styles.inputGroup}>
                                            <Search className={styles.inputIcon} size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search by name, email, or phone..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Student List */}
                                    <div className={styles.studentList}>
                                        {filteredStudents.length === 0 ? (
                                            <div className={styles.emptyState}>
                                                {searchQuery ? "No students found" : "Loading students..."}
                                            </div>
                                        ) : (
                                            filteredStudents.slice(0, 5).map((student) => (
                                                <div
                                                    key={student.id}
                                                    className={`${styles.studentCard} ${selectedStudents.includes(student.id) ? styles.selectedCard : ""}`}
                                                    onClick={() => setSelectedStudents(prev => 
                                                        prev.includes(student.id) 
                                                            ? prev.filter(id => id !== student.id)
                                                            : [...prev, student.id]
                                                    )}
                                                >
                                                    <div className={styles.studentInfo}>
                                                        <div className={styles.studentAvatar}>
                                                            {student.fullName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className={styles.studentName}>{student.fullName}</div>
                                                            <div className={styles.studentEmail}>{student.email}</div>
                                                            {student.phone && (
                                                                <div className={styles.studentPhone}>{student.phone}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {selectedStudents.includes(student.id) && (
                                                        <Check size={20} className={styles.checkIcon} />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : activeTab === "new" ? (
                                <>
                                    {/* New Student Form */}
                                    <div className={styles.inputGroup}>
                                        <Mail className={styles.inputIcon} size={18} />
                                        <input
                                            type="email"
                                            placeholder="Email Address *"
                                            value={newStudentEmail}
                                            onChange={(e) => setNewStudentEmail(e.target.value)}
                                            required={activeTab === "new"}
                                        />
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <User className={styles.inputIcon} size={18} />
                                        <input
                                            type="text"
                                            placeholder="Full Name *"
                                            value={newStudentName}
                                            onChange={(e) => setNewStudentName(e.target.value)}
                                            required={activeTab === "new"}
                                        />
                                    </div>

                                    <div className={styles.inputGroup}>
                                        <Phone className={styles.inputIcon} size={18} />
                                        <input
                                            type="tel"
                                            placeholder="Phone Number (optional)"
                                            value={newStudentPhone}
                                            onChange={(e) => setNewStudentPhone(e.target.value)}
                                        />
                                    </div>

                                    <div className={styles.infoNote}>
                                        <GraduationCap size={14} />
                                        A password setup email will be sent to the student.
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Bulk Student Form */}
                                    <div className={styles.fieldGroup}>
                                        <label className={styles.fieldLabel}>
                                            <Mail size={16} />
                                            Student Emails (Comma or newline separated)
                                        </label>
                                        <textarea
                                            placeholder="student1@example.com, student2@example.com&#10;student3@example.com"
                                            value={bulkEmailsText}
                                            onChange={(e) => setBulkEmailsText(e.target.value)}
                                            required={activeTab === "bulk"}
                                            style={{ width: '100%', padding: '12px', minHeight: '120px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-color)', resize: 'vertical' }}
                                        />
                                    </div>

                                    <div className={styles.infoNote}>
                                        <Users size={14} />
                                        Only existing students will be enrolled. Unregistered emails will be skipped and reported back to you.
                                    </div>
                                </>
                            )}

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button 
                                className={styles.submitBtn} 
                                type="submit" 
                                disabled={loading || (activeTab === "existing" && selectedStudents.length === 0) || (activeTab === "new" && (!newStudentEmail || !newStudentName)) || (activeTab === "bulk" && !bulkEmailsText.trim())}
                            >
                                {loading ? (
                                    <><Loader variant="button" /> Enrolling...</>
                                ) : activeTab === "new" ? (
                                    "Register & Enroll Student"
                                ) : activeTab === "bulk" ? (
                                    "Bulk Enroll Students"
                                ) : (
                                    "Enroll Student"
                                )}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
