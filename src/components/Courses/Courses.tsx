"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Courses.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { COURSES, Course } from "@/constants/courses";
import CourseCard from "./CourseCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { fetchPublishedDynamicCourses, mergeStaticAndDynamicCourses } from "@/lib/dynamic-course-client";

export default function Courses() {
    const [filter, setFilter] = useState("All");
    const [dynamicCourses, setDynamicCourses] = useState<Course[]>([]);
    const categories = ["All", "FCPS", "Exams", "Residency"];

    useEffect(() => {
        let cancelled = false;

        const loadDynamicCourses = async () => {
            try {
                const courses = await fetchPublishedDynamicCourses();
                if (!cancelled) {
                    setDynamicCourses(courses);
                }
            } catch {
                // Keep the static featured set if dynamic fetch fails.
            }
        };

        loadDynamicCourses();

        return () => {
            cancelled = true;
        };
    }, []);

    const allCourses = useMemo(
        () => mergeStaticAndDynamicCourses(COURSES, dynamicCourses),
        [dynamicCourses]
    );

    const filtered = filter === "All"
        ? allCourses.slice(0, 3)
        : allCourses.filter(c => c.category === filter).slice(0, 3);

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
