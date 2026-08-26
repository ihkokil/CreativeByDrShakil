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

            <div className={styles.coursesList}>
                {filteredCourses.map((course) => (
                    <div key={course.id} className={styles.courseCardItem}>
                        <div className={styles.cardMain}>
                            <div className={styles.thumbWrapper}>
                                <Image
                                    src={course.imageUrl || "/placeholder.svg"} 
                                    alt={course.title}
                                    fill 
                                    style={{ objectFit: 'cover' }}
                                    unoptimized 
                                />
                                {course.duration && (
                                    <span className={styles.durationTag}>{course.duration}</span>
                                )}
                            </div>
                            
                            <div className={styles.cardDetails}>
                                <div className={styles.cardTitleRow}>
                                    <h3 className={styles.courseTitle}>{course.title}</h3>
                                    <div className={styles.badgeGroup}>
                                        <span className={`${styles.statusBadge} ${styles[course.status]}`}>
                                            {course.status}
                                        </span>
                                        <span className={styles.modeBadge}>
                                            {!course.releaseMode || course.releaseMode === 'circular' ? "Circular" : "Linear"}
                                        </span>
                                    </div>
                                </div>

                                <div className={styles.cardMetricsRow}>
                                    <div className={styles.metricItem}>
                                        <span className={styles.metricLabel}>Pricing</span>
                                        <div className={styles.priceContainer}>
                                            {course.salePrice ? (
                                                <>
                                                    <span className={styles.mainPrice}>৳{course.salePrice}</span>
                                                    <span className={styles.oldPrice}>৳{course.price}</span>
                                                </>
                                            ) : (
                                                <span className={styles.mainPrice}>৳{course.price}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.metricItem}>
                                        <span className={styles.metricLabel}>Start Date</span>
                                        <span className={styles.metricValue}>
                                            {course.courseStartDate ? new Date(course.courseStartDate).toLocaleDateString() : 'Self-Paced'}
                                        </span>
                                    </div>

                                    <div className={styles.metricItem}>
                                        <span className={styles.metricLabel}>Enrollment</span>
                                        <div className={styles.enrolledBadge}>
                                            <Users size={14} />
                                            <span>{course.enrolledCount || 0} Students</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.cardActionsRow}>
                            <button 
                                className={styles.primaryActionButton} 
                                onClick={() => setSelectedCourseForStudents({ id: course.id, title: course.title })} 
                                title="Manage Students"
                            >
                                <Users size={15} /> Manage Students
                            </button>
                            <button 
                                className={styles.actionBtnIcon} 
                                onClick={() => window.open(`/courses/${course.slug}`, '_blank')} 
                                title="View on Student Site"
                            >
                                <ExternalLink size={15} /> <span>Preview</span>
                            </button>
                            <button 
                                className={styles.actionBtnIcon} 
                                onClick={() => router.push(`/teacher/dashboard/courses/${course.id}/edit`)} 
                                title="Edit Course"
                            >
                                <Edit2 size={15} /> <span>Edit</span>
                            </button>
                            <button 
                                className={styles.actionBtnIcon} 
                                onClick={() => handleDuplicate(course.id)} 
                                title="Duplicate Course"
                            >
                                <Copy size={15} /> <span>Duplicate</span>
                            </button>
                            {course.status !== "archived" && (
                                <button 
                                    className={styles.actionBtnIcon} 
                                    onClick={() => handleArchive(course.id, course.title)} 
                                    title="Archive Course"
                                >
                                    <Archive size={15} /> <span>Archive</span>
                                </button>
                            )}
                            <button 
                                className={`${styles.actionBtnIcon} ${styles.deleteAction}`} 
                                onClick={() => handleDelete(course.id, course.title)}
                                title="Delete Course"
                            >
                                <Trash2 size={15} /> <span>Delete</span>
                            </button>
                        </div>
                    </div>
                ))}
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

