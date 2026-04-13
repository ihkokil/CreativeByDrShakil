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
    ChevronRight,
    Loader2,
    Eye,
    Copy,
    Archive
} from "lucide-react";
import Image from "next/image";
import styles from "./CoursesTab.module.css";
import { motion, AnimatePresence } from "framer-motion";

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
}

export default function CoursesTab() {
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

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

    const handleDelete = async (courseId: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch(`/api/teacher/courses/${courseId}`, {
                method: "DELETE",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const data = await response.json();
            if (!response.ok) {
                alert(data.error || "Failed to delete course.");
                return;
            }

            setCourses(prev => prev.filter(c => c.id !== courseId));
        } catch (err) {
            console.error(err);
            alert("An error occurred while deleting the course.");
        }
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
                alert(data.error || "Failed to duplicate course.");
                return;
            }

            // Refresh list
            fetchCourses();
            alert("Course duplicated successfully as draft.");
        } catch (err) {
            console.error(err);
            alert("An error occurred while duplicating the course.");
        }
    };

    const handleArchive = async (courseId: string, title: string) => {
        if (!confirm(`Are you sure you want to archive "${title}"? This will hide it from the student site.`)) {
            return;
        }

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
                alert(data.error || "Failed to archive course.");
                return;
            }

            setCourses(prev => prev.map(c => c.id === courseId ? { ...c, status: "archived" } : c));
            alert("Course archived successfully.");
        } catch (err) {
            console.error(err);
            alert("An error occurred while archiving the course.");
        }
    };

    const filteredCourses = courses.filter(c => 
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className={styles.loading}>
                <Loader2 size={32} className={styles.spinner} />
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
                    <button className={styles.filterBtn}><Filter size={18} /> Filters</button>
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
                            <th>Enrolled</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence mode="popLayout">
                            {filteredCourses.map((course) => (
                                <motion.tr 
                                    key={course.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    layout
                                >
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
                                        <div className={styles.statsCol}>
                                            <span className={styles.mainStat}>{course.enrolledCount}</span>
                                            <span className={styles.subStat}>Students</span>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={styles.rowActions}>
                                            <button className={styles.iconAction} onClick={() => window.open(`/courses/${course.slug}`, '_blank')} title="View on Student Site">
                                                <ExternalLink size={18} />
                                            </button>
                                            <button 
                                                className={styles.iconAction} 
                                                onClick={() => router.push(`/teacher/dashboard/courses/create?courseId=${course.id}`)} 
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
                                </motion.tr>
                            ))}
                        </AnimatePresence>
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
        </div>
    );
}
