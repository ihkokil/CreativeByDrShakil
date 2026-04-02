"use client";

import { useState } from "react";
import styles from "./Courses.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { COURSES } from "@/constants/courses";
import CourseCard from "./CourseCard";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Courses() {
    const [filter, setFilter] = useState("All");
    const categories = ["All", "FCPS", "Exams", "Residency"];

    const filtered = filter === "All"
        ? COURSES.slice(0, 3) // Just show first 3 for home
        : COURSES.filter(c => c.category === filter).slice(0, 3);

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
