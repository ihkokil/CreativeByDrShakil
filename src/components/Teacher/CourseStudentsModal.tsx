"use client";

import { useEffect, useState, useMemo } from "react";
import { X, Search, Users, UserPlus } from "lucide-react";
import Loader from "@/components/UI/Loader";
import Image from "next/image";
import styles from "./CourseStudentsModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import StudentRulesModal from "./StudentRulesModal";
import StudentIndividualOverridesModal from "./StudentIndividualOverridesModal";
import EnrollStudentModal from "./EnrollStudentModal";
interface CourseStudentsModalProps {
    courseId: string;
    courseTitle: string;
    onClose: () => void;
}

type StudentSummary = {
    id: string;
    fullName: string;
    email: string;
    profileImage: string | null;
    progressPercent: number;
};

const ITEMS_PER_PAGE = 20;

const initials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function CourseStudentsModal({ courseId, courseTitle, onClose }: CourseStudentsModalProps) {
    const [students, setStudents] = useState<StudentSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);
    const [advancedStudent, setAdvancedStudent] = useState<StudentSummary | null>(null);
    const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

    // Advanced contexts
    const [selectedCourseObj, setSelectedCourseObj] = useState<any>(null);
    const [allOverrides, setAllOverrides] = useState<any[]>([]);
    const [computedDatesMap, setComputedDatesMap] = useState<Record<string, Record<string, string>>>({});

    const fetchStudents = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/teacher/students?courseId=${encodeURIComponent(courseId)}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            if (response.ok && data.students) {
                setStudents(data.students);
                setSelectedCourseObj(data.selectedCourse);
                setAllOverrides(data.overrides || []);
                setComputedDatesMap(data.studentComputedDatesMap || {});
            }
        } catch (error) {
            console.error("Failed to fetch students", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [courseId]);

    const filteredStudents = useMemo(() => {
        if (!searchQuery.trim()) return students;
        const lowerQ = searchQuery.toLowerCase();
        return students.filter(s => 
            s.fullName.toLowerCase().includes(lowerQ) || 
            s.email.toLowerCase().includes(lowerQ)
        );
    }, [students, searchQuery]);

    const totalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
    const paginatedStudents = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredStudents.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredStudents, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <motion.div 
                className={styles.modal} 
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
            >
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <h2>Enrolled Students</h2>
                        <p>{courseTitle}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchBox}>
                        <Search size={18} />
                        <input 
                            type="text" 
                            placeholder="Search by name or email..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button 
                        className={styles.pageBtn} 
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '44px' }}
                        onClick={() => setIsEnrollModalOpen(true)}
                    >
                        <UserPlus size={18} /> Add Student
                    </button>
                </div>

                <div className={styles.body}>
                    {loading ? (
                        <div className={styles.loadingState}>
                            <Loader variant="inline" text="Loading students..." />
                            <p>Loading students...</p>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className={styles.emptyState}>
                            <Users size={48} />
                            <h3>No students found</h3>
                            <p>Try adjusting your search query.</p>
                        </div>
                    ) : (
                        <div className={styles.studentGrid}>
                            {paginatedStudents.map(student => (
                                <button 
                                    key={student.id} 
                                    className={styles.studentCard}
                                    onClick={() => setSelectedStudent(student)}
                                >
                                    <div className={styles.avatar}>
                                        {student.profileImage ? (
                                            <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized />
                                        ) : (
                                            initials(student.fullName)
                                        )}
                                    </div>
                                    <div className={styles.info}>
                                        <span className={styles.name}>{student.fullName}</span>
                                        <span className={styles.email}>{student.email}</span>
                                        <div className={styles.progressWrap}>
                                            <div className={styles.progressBar}>
                                                <div className={styles.progressFill} style={{ width: `${student.progressPercent}%` }} />
                                            </div>
                                            <span className={styles.progressText}>{student.progressPercent}%</span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {!loading && filteredStudents.length > 0 && (
                    <div className={styles.pagination}>
                        <span className={styles.pageInfo}>
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length}
                        </span>
                        <div className={styles.pageControls}>
                            <button 
                                className={styles.pageBtn} 
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <button 
                                className={styles.pageBtn} 
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            <AnimatePresence>
                {selectedStudent && (
                    <StudentRulesModal
                        courseId={courseId}
                        userId={selectedStudent.id}
                        studentName={selectedStudent.fullName}
                        onClose={() => setSelectedStudent(null)}
                        onSuccess={() => {
                            setSelectedStudent(null);
                            alert("Rules updated successfully!");
                            fetchStudents(); // refresh overrides
                        }}
                        onOpenAdvanced={() => {
                            const student = selectedStudent;
                            setSelectedStudent(null);
                            setAdvancedStudent(student);
                        }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {advancedStudent && selectedCourseObj && (
                    <StudentIndividualOverridesModal
                        courseId={courseId}
                        userId={advancedStudent.id}
                        studentName={advancedStudent.fullName}
                        selectedCourse={selectedCourseObj}
                        overrides={allOverrides.filter(o => o.userId === advancedStudent.id)}
                        computedDates={computedDatesMap[advancedStudent.id] || {}}
                        onClose={() => setAdvancedStudent(null)}
                        onSuccess={() => {
                            fetchStudents(); // refresh overrides
                        }}
                    />
                )}
            </AnimatePresence>

            <EnrollStudentModal
                courseId={courseId}
                isOpen={isEnrollModalOpen}
                onClose={() => setIsEnrollModalOpen(false)}
                onSuccess={() => {
                    setIsEnrollModalOpen(false);
                    fetchStudents();
                }}
            />
        </div>
    );
}
