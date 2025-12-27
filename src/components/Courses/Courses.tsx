"use client";

import { useState } from "react";
import styles from "./Courses.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Clock, BarChart } from "lucide-react";

const courseData = [
    { id: 1, title: "FCPS Part I: Internal Medicine", category: "FCPS", price: "৳5,000", rating: 4.8 },
    { id: 2, title: "Surgery High Yield MCQs", category: "Exams", price: "৳4,500", rating: 4.9 },
    { id: 3, title: "Pediatrics Residency Masterclass", category: "Residency", price: "৳6,000", rating: 4.7 },
    { id: 4, title: "Gynae & Obs Part II Theory", category: "Part II", price: "Free", rating: 4.9 },
    { id: 5, title: "Radiology Image-based Quiz", category: "Exams", price: "৳2,500", rating: 5.0 },
    { id: 6, title: "Foundation Series: Anatomy", category: "FCPS", price: "Free", rating: 4.6 },
];

export default function Courses() {
    const [filter, setFilter] = useState("All");
    const categories = ["All", "FCPS", "Exams", "Residency", "Part II"];

    const filtered = filter === "All"
        ? courseData
        : courseData.filter(c => c.category === filter);

    return (
        <section className="section-padding">
            <div className={styles.header}>
                <h2 className={styles.sectionTitle}>Curated Course Library</h2>
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

            <motion.div layout className={styles.grid}>
                <AnimatePresence mode="popLayout">
                    {filtered.map(course => (
                        <motion.div
                            layout
                            key={course.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className={`${styles.card} glass`}
                        >
                            <div className={styles.cardInfo}>
                                <span className={styles.category}>{course.category}</span>
                                <h3>{course.title}</h3>
                                <div className={styles.meta}>
                                    <span><BookOpen size={14} /> 24 Lessons</span>
                                    <span><Clock size={14} /> 12h Content</span>
                                </div>
                            </div>
                            <div className={styles.cardFooter}>
                                <span className={styles.price}>{course.price}</span>
                                <button className={styles.enrollBtn}>View Details</button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </motion.div>
        </section>
    );
}
