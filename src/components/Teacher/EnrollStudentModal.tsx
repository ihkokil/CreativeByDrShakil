"use client";

import { useState, useEffect } from "react";
import styles from "./EnrollStudentModal.module.css";
import Loader from "@/components/UI/Loader";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, User, Mail, Phone, BookOpen, Check, UserPlus, GraduationCap } from "lucide-react";

interface Student {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
}

interface Props {
    courseId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EnrollStudentModal({ courseId, isOpen, onClose, onSuccess }: Props) {
    const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
    
    // Data states
    const [students, setStudents] = useState<Student[]>([]);
    
    // Form states
    const [selectedStudent, setSelectedStudent] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    
    // New student form states
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentPhone, setNewStudentPhone] = useState("");
    
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
            
            const requestBody = isNewStudent ? {
                courseId,
                isNewStudent: true,
                email: newStudentEmail.trim().toLowerCase(),
                fullName: newStudentName.trim(),
                phone: newStudentPhone.trim() || undefined,
            } : {
                courseId,
                isNewStudent: false,
                studentId: selectedStudent,
            };

            if (isNewStudent && (!newStudentEmail || !newStudentName)) {
                showMessage({ type: 'error', text: 'Email and full name are required for new students.' });
                setLoading(false);
                return;
            }

            if (!isNewStudent && !selectedStudent) {
                showMessage({ type: 'error', text: 'Please select a student.' });
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
                setSelectedStudent("");
                setNewStudentEmail("");
                setNewStudentName("");
                setNewStudentPhone("");
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
        setSelectedStudent("");
        setSearchQuery("");
        setNewStudentEmail("");
        setNewStudentName("");
        setNewStudentPhone("");
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
                <div className={styles.overlay} onClick={handleClose}>
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
                                Existing Student
                            </button>
                            <button
                                type="button"
                                className={`${styles.tab} ${activeTab === "new" ? styles.activeTab : ""}`}
                                onClick={() => setActiveTab("new")}
                            >
                                <UserPlus size={16} />
                                New Registration
                            </button>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
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
                                                    className={`${styles.studentCard} ${selectedStudent === student.id ? styles.selectedCard : ""}`}
                                                    onClick={() => setSelectedStudent(student.id)}
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
                                                    {selectedStudent === student.id && (
                                                        <Check size={20} className={styles.checkIcon} />
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            ) : (
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
                            )}

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button 
                                className={styles.submitBtn} 
                                type="submit" 
                                disabled={loading || (activeTab === "existing" ? !selectedStudent : (!newStudentEmail || !newStudentName))}
                            >
                                {loading ? (
                                    <><Loader variant="button" /> Enrolling...</>
                                ) : activeTab === "new" ? (
                                    "Register & Enroll Student"
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
