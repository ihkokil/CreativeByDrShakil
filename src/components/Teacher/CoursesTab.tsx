"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
    BookOpen, 
    Plus, 
    MoreHorizontal, 
    Trash2, 
    Edit2, 
    Search, 
    Filter, 
    ExternalLink,
    Users,
    Settings,
    MoreVertical,
    ChevronRight,
    Eye,
    Copy,
    Archive
} from "lucide-react";
import Image from "next/image";
import styles from "./CoursesTab.module.css";
import { motion, AnimatePresence } from "framer-motion";
import Loader from "@/components/UI/Loader";
import CourseStudentsModal from "./CourseStudentsModal";
import ConfirmModal from "@/components/UI/ConfirmModal";
import AlertModal from "@/components/UI/AlertModal";

interface Course {
    id: string;
    title: string;
    slug: string;
    price: number;
    salePrice?: number;
    imageUrl?: string;
    status: "draft" | "published" | "scheduled" | "archived";
    duration: string;
    courseStartDate?: string;
    instructors: { name: string }[];
    enrolledCount?: number;
    revenue?: number;
    releaseMode?: string | null;
}

export default function CoursesTab() {
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedCourseForStudents, setSelectedCourseForStudents] = useState<{id: string, title: string} | null>(null);

    // Alert & Confirm Modal States
    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title?: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({ isOpen: false, message: '', type: 'info' });

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title?: string;
        message: React.ReactNode | string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info' | 'primary';
        isSubmitting?: boolean;
        onConfirm: () => void | Promise<void>;
    }>({ isOpen: false, message: '', onConfirm: () => {} });

    const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
        setAlertConfig({ isOpen: true, message, type, title });
    };

    const showConfirm = (options: {
        title?: string;
        message: React.ReactNode | string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info' | 'primary';
        onConfirm: () => void | Promise<void>;
    }) => {
        setConfirmConfig({
            isOpen: true,
            title: options.title,
            message: options.message,
            confirmText: options.confirmText || 'Confirm',
            variant: options.variant || 'danger',
            isSubmitting: false,
            onConfirm: options.onConfirm,
        });
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/teacher/courses", {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const data = await response.json();
            // Map dynamic counts from the API
            const enhanced = (data.courses || []).map((c: any) => ({
                ...c,
                enrolledCount: c._count?.orders || 0
            }));
            setCourses(enhanced);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (courseId: string, title: string) => {
        showConfirm({
            title: 'Delete Course?',
            message: `Are you sure you want to permanently delete "${title}"? All associated lessons, quizzes, and curriculum structure will be removed.`,
            confirmText: 'Delete Course',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem("auth_token");
                    const response = await fetch(`/api/teacher/courses/${courseId}`, {
                        method: "DELETE",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        showAlert(data.error || "Failed to delete course.", "error");
                        return;
                    }

                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                    setCourses(prev => prev.filter(c => c.id !== courseId));
                    showAlert(`"${title}" deleted successfully.`, "success");
                } catch (err) {
                    showAlert("An error occurred while deleting the course.", "error");
                }
            }
        });
    };

    const handleDuplicate = async (courseId: string) => {
        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/teacher/courses/${courseId}/duplicate`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const data = await response.json();
            if (!response.ok) {
                showAlert(data.error || "Failed to duplicate course.", "error");
                return;
            }

            // Refresh list
            fetchCourses();
            showAlert("Course duplicated successfully as draft.", "success");
        } catch (err) {
            showAlert("An error occurred while duplicating the course.", "error");
        }
    };

    const handleArchive = (courseId: string, title: string) => {
        showConfirm({
            title: 'Archive Course?',
            message: `Are you sure you want to archive "${title}"? This will hide it from the public catalog for students.`,
            confirmText: 'Archive Course',
            variant: 'warning',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem("auth_token");
                    const response = await fetch(`/api/teacher/courses/${courseId}`, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ status: "archived" }),
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        showAlert(data.error || "Failed to archive course.", "error");
                        return;
                    }

                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, status: "archived" } : c));
                    showAlert("Course archived successfully.", "success");
                } catch (err) {
                    showAlert("An error occurred while archiving the course.", "error");
                }
            }
        });
    };


    const filteredCourses = courses.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "all" || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className={styles.loading}>
                <Loader variant="inline" text="Loading courses..." />
                <span>Syncing course data...</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.topBar}>
                <div className={styles.searchBox}>
                    <Search size={18} />
                    <input 
                        type="text" 
                        placeholder="Filter courses..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className={styles.actions}>
                    <div className={styles.filterWrapper}>
                        <button className={styles.filterBtn} onClick={() => setIsFilterOpen(!isFilterOpen)}>
                            <Filter size={18} /> Filters
                            {statusFilter !== "all" && <span className={styles.filterBadge} />}
                        </button>
                        
                        <AnimatePresence>
                            {isFilterOpen && (
                                <>
                                    <div className={styles.backdrop} onClick={() => setIsFilterOpen(false)} />
                                    <motion.div 
                                        className={styles.filterDropdown}
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    >
                                        <div className={styles.filterSection}>
                                            <span className={styles.filterLabel}>Course Status</span>
                                            <div className={styles.filterOptions}>
                                                {["all", "published", "draft", "archived"].map((status) => (
                                                    <button 
                                                        key={status}
                                                        className={`${styles.filterChip} ${statusFilter === status ? styles.active : ""}`}
                                                        onClick={() => {
                                                            setStatusFilter(status);
                                                            setIsFilterOpen(false);
                                                        }}
                                                    >
                                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <button 
                        className={styles.createBtn}
                        onClick={() => router.push("/teacher/dashboard/courses/create")}
                    >
                        <Plus size={18} /> Create New Program
                    </button>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Program Name</th>
                            <th>Status</th>
                            <th>Mode</th>
                            <th>Price</th>
                            <th>Start Date</th>
                            <th>Enrolled</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredCourses.map((course) => (
                            <tr key={course.id}>
                                    <td>
                                        <div className={styles.courseInfo}>
                                            <div className={styles.thumb}>
                                                <Image src={course.imageUrl || "/placeholder.svg"} alt="" fill style={{ objectFit: 'cover' }} />
                                            </div>
                                            <div className={styles.meta}>
                                                <span className={styles.title}>{course.title}</span>
                                                <span className={styles.duration}>{course.duration}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${styles.statusBadge} ${styles[course.status]}`}>
                                            {course.status}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={styles.dateText} style={{ fontWeight: 600 }}>
                                            {!course.releaseMode || course.releaseMode === 'circular' ? "Circular" : "Linear"}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.priceCol}>
                                            {course.salePrice ? (
                                                <>
                                                    <span className={styles.mainPrice}>৳{course.salePrice}</span>
                                                    <span className={styles.oldPrice}>৳{course.price}</span>
                                                </>
                                            ) : (
                                                <span className={styles.mainPrice}>৳{course.price}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={styles.dateText}>
                                            {course.courseStartDate ? new Date(course.courseStartDate).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className={styles.statsCol}>
                                            <span className={styles.mainStat}>{course.enrolledCount}</span>
                                            <span className={styles.subStat}>Students</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button 
                                                className={styles.iconAction} 
                                                onClick={() => setSelectedCourseForStudents({ id: course.id, title: course.title })} 
                                                title="Manage Students"
                                            >
                                                <Users size={18} />
                                            </button>
                                            <button className={styles.iconAction} onClick={() => window.open(`/courses/${course.slug}`, '_blank')} title="View on Student Site">
                                                <ExternalLink size={18} />
                                            </button>
                                            <button 
                                                className={styles.iconAction} 
                                                onClick={() => router.push(`/teacher/dashboard/courses/${course.id}/edit`)} 
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                className={styles.iconAction} 
                                                onClick={() => handleDuplicate(course.id)} 
                                                title="Duplicate"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            {course.status !== "archived" && (
                                                <button 
                                                    className={styles.iconAction} 
                                                    onClick={() => handleArchive(course.id, course.title)} 
                                                    title="Archive"
                                                >
                                                    <Archive size={18} />
                                                </button>
                                            )}
                                            <button 
                                                className={`${styles.iconAction} ${styles.delete}`} 
                                                onClick={() => handleDelete(course.id, course.title)}
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
            
            {filteredCourses.length === 0 && (
                <div className={styles.empty}>
                    <BookOpen size={48} />
                    <h3>No programs found</h3>
                    <p>Try adjusting your search or create a new course.</p>
                </div>
            )}

            <AnimatePresence>
                {selectedCourseForStudents && (
                    <CourseStudentsModal 
                        courseId={selectedCourseForStudents.id}
                        courseTitle={selectedCourseForStudents.title}
                        onClose={() => setSelectedCourseForStudents(null)}
                    />
                )}
            </AnimatePresence>

            {/* Reusable Confirmation Modal */}
            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmText={confirmConfig.confirmText}
                variant={confirmConfig.variant}
                isSubmitting={confirmConfig.isSubmitting}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Reusable Alert Modal */}
            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}

