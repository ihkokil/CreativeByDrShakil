"use client";

import { useState, useEffect } from "react";
import styles from "./AdminModal.module.css";
import customStyles from "./AddStudentToCourseModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, User, Mail, Phone, BookOpen, Check, UserPlus, GraduationCap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Student {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
}

interface Course {
    id: string;
    title: string;
    slug?: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddStudentToCourseModal({ isOpen, onClose, onSuccess }: Props) {
    const { session, role } = useAuth();
    const [activeTab, setActiveTab] = useState<"existing" | "new">("existing");
    
    // Data states
    const [students, setStudents] = useState<Student[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    
    // Form states
    const [selectedCourse, setSelectedCourse] = useState("");
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    
    // New student form states
    const [newStudentEmail, setNewStudentEmail] = useState("");
    const [newStudentName, setNewStudentName] = useState("");
    const [newStudentPhone, setNewStudentPhone] = useState("");
    
    // UI states
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchData = async () => {
        setLoadingData(true);
        try {
            const token = localStorage.getItem("auth_token");
            
            const apiPrefix = role === "admin" ? "/api/admin" : "/api/teacher";
            // Fetch students
            const studentsRes = await fetch(`${apiPrefix}/students`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (studentsRes.ok) {
                const studentsData = await studentsRes.json();
                setStudents(studentsData.students || []);
            }
            
            // Fetch courses
            const coursesRes = await fetch("/api/courses/dynamic");
            if (coursesRes.ok) {
                const coursesData = await coursesRes.json();
                setCourses(coursesData.courses || []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
        setLoadingData(false);
    };

    // Fetch students and courses when modal opens
    useEffect(() => {
        if (isOpen && session) {
            fetchData();
        }
    }, [isOpen, session]);

    const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
        setMessage(msg);
        setTimeout(() => {
            setMessage(null);
        }, 5000);
    };

    const filteredStudents = students.filter(s => 
        s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery))
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!session) {
                showMessage({ type: 'error', text: 'You must be logged in.' });
                setLoading(false);
                return;
            }

            if (!selectedCourse) {
                showMessage({ type: 'error', text: 'Please select a course.' });
                setLoading(false);
                return;
            }

            const token = localStorage.getItem("auth_token");
            const isNewStudent = activeTab === "new";
            const apiPrefix = role === "admin" ? "/api/admin" : "/api/teacher";
            
            if (isNewStudent) {
                if (!newStudentEmail || !newStudentName) {
                    showMessage({ type: 'error', text: 'Email and full name are required for new students.' });
                    setLoading(false);
                    return;
                }
                const response = await fetch(`${apiPrefix}/enrollments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                    body: JSON.stringify({
                        courseId: selectedCourse,
                        isNewStudent: true,
                        email: newStudentEmail.trim().toLowerCase(),
                        fullName: newStudentName.trim(),
                        phone: newStudentPhone.trim() || undefined,
                    }),
                });
                const data = await response.json();
                if (!response.ok) {
                    showMessage({ type: 'error', text: data.error || "Failed to enroll student." });
                } else {
                    showMessage({ type: 'success', text: data.message || "Student enrolled successfully!" });
                    setNewStudentEmail("");
                    setNewStudentName("");
                    setNewStudentPhone("");
                    setTimeout(() => onSuccess(), 2000);
                }
            } else {
                if (selectedStudents.length === 0) {
                    showMessage({ type: 'error', text: 'Please select at least one student.' });
                    setLoading(false);
                    return;
                }
                const promises = selectedStudents.map(studentId => 
                    fetch(`${apiPrefix}/enrollments`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: token ? `Bearer ${token}` : "",
                        },
                        body: JSON.stringify({
                            courseId: selectedCourse,
                            isNewStudent: false,
                            studentId: studentId,
                        }),
                    }).then(res => res.json().then(data => ({ ok: res.ok, data })))
                );
                
                const results = await Promise.all(promises);
                const failed = results.filter(r => !r.ok);
                
                if (failed.length === results.length) {
                    showMessage({ type: 'error', text: failed[0]?.data?.error || "Failed to enroll selected students." });
                } else if (failed.length > 0) {
                    showMessage({ type: 'success', text: `Enrolled ${results.length - failed.length} students. ${failed.length} failed.` });
                    setSelectedStudents([]);
                    setSearchQuery("");
                    setTimeout(() => onSuccess(), 2000);
                } else {
                    showMessage({ type: 'success', text: "All selected students enrolled successfully!" });
                    setSelectedStudents([]);
                    setSearchQuery("");
                    setTimeout(() => onSuccess(), 2000);
                }
            }
        } catch (err: any) {
            showMessage({ type: 'error', text: "Network error. Please try again." });
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessage(null);
        setSelectedCourse("");
        setSelectedStudents([]);
        setSearchQuery("");
        setNewStudentEmail("");
        setNewStudentName("");
        setNewStudentPhone("");
        setActiveTab("existing");
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    className={styles.overlay}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClose}
                >
                    <motion.div
                        className={`${styles.modal} ${customStyles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={handleClose}>
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
                        <div className={customStyles.tabs}>
                            <button
                                className={`${customStyles.tab} ${activeTab === "existing" ? customStyles.activeTab : ""}`}
                                onClick={() => setActiveTab("existing")}
                            >
                                <User size={16} />
                                Existing Student
                            </button>
                            <button
                                className={`${customStyles.tab} ${activeTab === "new" ? customStyles.activeTab : ""}`}
                                onClick={() => setActiveTab("new")}
                            >
                                <UserPlus size={16} />
                                New Registration
                            </button>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            {/* Course Selection */}
                            <div className={customStyles.fieldGroup}>
                                <label className={customStyles.fieldLabel}>
                                    <BookOpen size={16} />
                                    Select Course *
                                </label>
                                <select
                                    className={styles.selectInput}
                                    value={selectedCourse}
                                    onChange={(e) => setSelectedCourse(e.target.value)}
                                    required
                                    disabled={loadingData}
                                >
                                    <option value="">{loadingData ? "Loading courses..." : "Choose a course"}</option>
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.title}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {activeTab === "existing" ? (
                                <>
                                    {/* Search for existing student */}
                                    <div className={customStyles.fieldGroup}>
                                        <label className={customStyles.fieldLabel}>
                                            <Search size={16} />
                                            Search Students
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
                                    <div className={customStyles.studentList}>
                                        {filteredStudents.length === 0 ? (
                                            <div className={customStyles.emptyState}>
                                                {searchQuery ? "No students found" : "Type to search students"}
                                            </div>
                                        ) : (
                                            filteredStudents.map((student) => (
                                                <div
                                                    key={student.id}
                                                    className={`${customStyles.studentCard} ${selectedStudents.includes(student.id) ? customStyles.selectedCard : ""}`}
                                                    onClick={() => setSelectedStudents(prev => 
                                                        prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id]
                                                    )}
                                                >
                                                    <div className={customStyles.studentInfo}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={selectedStudents.includes(student.id)} 
                                                            readOnly 
                                                            className={customStyles.checkbox}
                                                        />
                                                        <div className={customStyles.studentAvatar}>
                                                            {student.full_name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className={customStyles.studentName}>{student.full_name}</div>
                                                            <div className={customStyles.studentEmail}>{student.email}</div>
                                                            {student.phone && (
                                                                <div className={customStyles.studentPhone}>{student.phone}</div>
                                                            )}
                                                        </div>
                                                    </div>
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

                                    <div className={customStyles.infoNote}>
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
                                disabled={loading || !selectedCourse || (activeTab === "existing" ? selectedStudents.length === 0 : (!newStudentEmail || !newStudentName))}
                            >
                                {loading 
                                    ? "Enrolling..." 
                                    : activeTab === "new" 
                                        ? "Register & Enroll Student" 
                                        : `Enroll Selected (${selectedStudents.length})`
                                }
                            </button>
                        </form>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
