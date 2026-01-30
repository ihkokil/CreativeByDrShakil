"use client";

import { useMemo, useState, useEffect } from "react";
import styles from "./Courses.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { COURSES } from "@/constants/courses";
import CourseCard from "./CourseCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";

export default function Courses() {
    const [filter, setFilter] = useState("All");
    const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
    const categories = ["All", "FCPS", "Exams", "Residency"];

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

    const displayCourses = useMemo(() => enrichCoursesWithTeachers(COURSES, teachers), [teachers]);

    const filtered = filter === "All"
        ? displayCourses.slice(0, 3) // Just show first 3 for home
        : displayCourses.filter(c => c.category === filter).slice(0, 3);

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
                            {categories.map(cat => (
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
                        {filtered.map(course => (
                            <CourseCard key={course.id} course={course} />
                        ))}
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
