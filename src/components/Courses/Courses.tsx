"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Courses.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { Course } from "@/constants/courses";
import CourseCard from "./CourseCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";
import { fetchPublishedDynamicCourses } from "@/lib/dynamic-course-client";
import { CategorySummary, fetchCategories } from "@/lib/categories";
import CourseCardSkeleton from "./CourseCardSkeleton";

export default function Courses() {
    const [filter, setFilter] = useState("All");
    const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
    const [dynamicCourses, setDynamicCourses] = useState<Course[]>([]);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadDynamicCourses = async () => {
            setLoading(true);
            try {
                const courses = await fetchPublishedDynamicCourses();
                if (!cancelled) {
                    setDynamicCourses(courses);
                }
            } catch {
                // Keep the static featured set if dynamic fetch fails.
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadDynamicCourses();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadTeachers = async () => {
            try {
                const response = await fetch("/api/teachers");
                const data = await response.json();
                if (!cancelled && response.ok && Array.isArray(data.teachers)) {
                    setTeachers(data.teachers);
                }
            } catch {
                // Keep static fallback data if teacher directory fetch fails.
            }
        };

        loadTeachers();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadCategories = async () => {
            try {
                const list = await fetchCategories();
                if (!cancelled) {
                    setCategories(list);
                }
            } catch {
                // Keep the course-derived filters if category fetch fails.
            }
        };

        loadCategories();

        return () => {
            cancelled = true;
        };
    }, []);

    const displayCourses = useMemo(() => enrichCoursesWithTeachers(dynamicCourses, teachers), [dynamicCourses, teachers]);
    const allCourses = displayCourses;

    const filtered = filter === "All"
        ? allCourses.slice(0, 3)
        : allCourses.filter(c => c.category === filter).slice(0, 3);

    const categoryTabs = [
        "All",
        ...new Set([
            ...categories.map((category) => category.displayName),
            ...allCourses.map((course) => course.category),
        ]),
    ];

    return (
        <section className="section-padding">
            <div className={styles.content}>
                <div className={styles.header}>
                    <div className={styles.titles}>
                        <h2 className={styles.sectionTitle}>Featured Courses</h2>
                        <p className={styles.subtitle}>Hand-picked professional training by senior consultants.</p>
                    </div>
                    <div className={styles.tabsSection}>
                        <div className={styles.tabs}>
                            {categoryTabs.map(cat => (
                                <button
                                    key={cat}
                                    className={`${styles.tab} ${filter === cat ? styles.activeTab : ""}`}
                                    onClick={() => setFilter(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <motion.div layout className={styles.grid}>
                    <AnimatePresence mode="popLayout">
                        {loading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={`skeleton-${i}`} className={styles.cardWrapper}>
                                    <CourseCardSkeleton />
                                </div>
                            ))
                        ) : (
                            filtered.map(course => (
                                <CourseCard key={course.id} course={course} />
                            ))
                        )}
                    </AnimatePresence>
                </motion.div>

                <div className={styles.footer}>
                    <Link href="/courses" className={styles.viewAllBtn}>
                        View All Courses <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        </section>
    );
}
