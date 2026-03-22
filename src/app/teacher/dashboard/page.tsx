"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useMemo, useState } from "react";
import CoursesTab from "@/components/Teacher/CoursesTab";
import styles from "./TeacherDashboard.module.css";
import {
    BookOpen,
    Users,
    Star,
    CheckCircle,
    Plus,
} from "lucide-react";
import VideoLibraryManager from "@/components/Teacher/VideoLibraryManager";
import Image from "next/image";

interface TeacherCourseCard {
    id: string;
    title: string;
    slug: string | null;
    imageUrl?: string | null;
    status: "draft" | "published" | "scheduled" | "archived";
    category?: { displayName: string } | null;
    duration: string;
    instructors: Array<{ id: string; name: string; designation?: string | null }>;
    _count?: { orders?: number };
}

function TeacherDashboardContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [courses, setCourses] = useState<TeacherCourseCard[]>([]);
    const [coursesLoading, setCoursesLoading] = useState(true);

    const activeTab = (searchParams.get("tab") as "overview" | "courses" | "students" | "assignments" | "library") || "overview";

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (loading || !user) {
            return;
        }

        let cancelled = false;

        const loadCourses = async () => {
            try {
                setCoursesLoading(true);
                const token = localStorage.getItem("auth_token");
                const response = await fetch("/api/teacher/courses", {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                const data = await response.json();
                if (!cancelled && response.ok) {
                    setCourses(Array.isArray(data.courses) ? data.courses : []);
                }
            } finally {
                if (!cancelled) {
                    setCoursesLoading(false);
                }
            }
        };

        loadCourses();

        return () => {
            cancelled = true;
        };
    }, [loading, user]);

    const stats = useMemo(() => {
        const totalCourses = courses.length;
        const publishedCourses = courses.filter((course) => course.status === "published").length;
        const draftCourses = courses.filter((course) => course.status === "draft").length;
        const activeStudents = courses.reduce((sum, course) => sum + (course._count?.orders || 0), 0);

        return { totalCourses, publishedCourses, draftCourses, activeStudents };
    }, [courses]);

    if (loading || !user) {
        return <div className={styles.loader}>Loading Teacher Dashboard...</div>;
    }

    return (
        <div className={styles.pageContent}>
            {activeTab === "overview" && (
                <div className={styles.stack}>
                    <section className={styles.metricsGrid}>
                        <div className={styles.metricCard}><BookOpen size={20} /><div><h3>{stats.totalCourses}</h3><p>Total Courses</p></div></div>
                        <div className={styles.metricCard}><Users size={20} /><div><h3>{stats.activeStudents}</h3><p>Active Students</p></div></div>
                        <div className={styles.metricCard}><CheckCircle size={20} /><div><h3>{stats.publishedCourses}</h3><p>Published Courses</p></div></div>
                        <div className={styles.metricCard}><Star size={20} /><div><h3>{stats.draftCourses}</h3><p>Draft Courses</p></div></div>
                    </section>

                    <section className={styles.panel}>
                        <div className={styles.panelHeaderRow}>
                            <div>
                                <h2 className={styles.panelTitle}>Your Courses</h2>
                                <p className={styles.panelSubtitle}>Manage content, publishing, and student access from one place.</p>
                            </div>
                            <button className={styles.primaryBtn} onClick={() => router.push('/teacher/dashboard/courses/create')}>
                                <Plus size={16} /> Add Course
                            </button>
                        </div>
                        {coursesLoading ? (
                            <div className={styles.loadingInline}>Loading your courses...</div>
                        ) : null}
                        <div className={styles.courseGrid}>
                            {courses.map((course) => (
                                <article key={course.id} className={styles.courseCard}>
                                    <div className={styles.thumb}>
                                        <Image src={course.imageUrl || "/placeholder.svg"} alt={course.title} fill style={{ objectFit: "cover" }} unoptimized />
                                    </div>
                                    <div className={styles.courseBody}>
                                        <span className={styles.category}>{course.category?.displayName || "General"}</span>
                                        <h3>{course.title}</h3>
                                        <div className={styles.metaRow}>
                                            <span><Users size={14} /> {course._count?.orders || 0} Students</span>
                                            <span><CheckCircle size={14} /> {course.status}</span>
                                        </div>
                                        <button
                                            className={styles.primaryBtn}
                                            onClick={() => router.push('/teacher/dashboard/courses/create')}
                                        >
                                            Manage Content
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "courses" && (
                <CoursesTab />
            )}

            {activeTab === "students" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeaderRow}>
                        <div>
                            <h2 className={styles.panelTitle}>Students</h2>
                            <p className={styles.panelSubtitle}>Open the dedicated students workspace to review enrollments and module access.</p>
                        </div>
                        <button className={styles.primaryBtn} onClick={() => router.push('/teacher/dashboard/students')}>
                            <Users size={16} /> Open Students Page
                        </button>
                    </div>
                    <div className={styles.simpleCards}>
                        <div className={styles.simpleCard}><strong>{stats.activeStudents}</strong><span>Total Enrollments</span></div>
                        <div className={styles.simpleCard}><strong>{stats.publishedCourses}</strong><span>Published Courses</span></div>
                        <div className={styles.simpleCard}><strong>{stats.totalCourses}</strong><span>Courses Managed</span></div>
                    </div>
                </section>
            )}

            {activeTab === "assignments" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Assignment Center</h2>
                    <div className={styles.assignmentList}>
                        <article className={styles.assignmentCard}><h3>Clinical Case Reflection</h3><p>32 pending reviews · due in 2 days</p></article>
                        <article className={styles.assignmentCard}><h3>Rapid Revision Quiz</h3><p>18 pending reviews · due in 4 days</p></article>
                    </div>
                </section>
            )}

            {activeTab === "library" && (
                <section className={styles.panelNoPad}>
                    <VideoLibraryManager />
                </section>
            )}
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Teacher Dashboard...</div>}>
            <TeacherDashboardContent />
        </Suspense>
    );
}
