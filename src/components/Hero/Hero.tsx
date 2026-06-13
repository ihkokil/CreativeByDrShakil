"use client";

import { motion } from "framer-motion";
import styles from "./Hero.module.css";
import { ArrowRight, MessageCircle, GraduationCap, BookOpen, Award, Users } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface HeroCourse {
    id: string;
    title: string;
    tag?: string;
    image?: string;
    slug?: string;
}

export default function Hero() {
    const [courses, setCourses] = useState<HeroCourse[]>([]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch("/api/courses/dynamic");
                const data = await res.json();
                if (!cancelled && res.ok && data.courses) {
                    const heroCourses = data.courses.slice(0, 3).map((c: any, i: number) => ({
                        id: c.id,
                        title: c.title,
                        tag: i === 0 ? "Best Seller" : i === 1 ? "High Yield" : "New",
                        image: c.image || "/placeholder.svg",
                        slug: c.slug
                    }));
                    setCourses(heroCourses);
                }
            } catch {
                // Fallback handled by empty state
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    return (
        <section className={styles.hero}>
            {/* Decorative elements */}
            <div className={styles.accentBar} />
            <div className={styles.gridPattern} />

            <div className={styles.container}>
                {/* Overline */}
                <motion.div
                    className={styles.overline}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <span className={styles.overlineDot} />
                    <span>Admission Open — 2026 Batches</span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    className={styles.headline}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    Master Your<br />
                    <span className={styles.headlineAccent}>Medical Career</span>
                </motion.h1>

                {/* Subheadline */}
                <motion.p
                    className={styles.subheadline}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.25 }}
                >
                    The most trusted academy for FCPS &amp; Residency preparation.
                    Case-based learning and high-yield MCQ banks crafted by senior consultants.
                </motion.p>

                {/* CTA Row */}
                <motion.div
                    className={styles.ctaRow}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                >
                    <Link href="/courses" className={styles.ctaPrimary}>
                        Explore Courses <ArrowRight size={20} />
                    </Link>
                    <Link href="/contact" className={styles.ctaSecondary}>
                        <MessageCircle size={20} /> Contact Us
                    </Link>
                </motion.div>

                {/* Stats Strip */}
                <motion.div
                    className={styles.statsStrip}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                >
                    <div className={styles.statItem}>
                        <div className={styles.statIcon}><Users size={22} /></div>
                        <div className={styles.statContent}>
                            <span className={styles.statNumber}>2,000+</span>
                            <span className={styles.statLabel}>Enrolled Doctors</span>
                        </div>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <div className={styles.statIcon}><BookOpen size={22} /></div>
                        <div className={styles.statContent}>
                            <span className={styles.statNumber}>{courses.length > 0 ? `${courses.length}+` : "20+"}</span>
                            <span className={styles.statLabel}>Expert Courses</span>
                        </div>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <div className={styles.statIcon}><Award size={22} /></div>
                        <div className={styles.statContent}>
                            <span className={styles.statNumber}>95%</span>
                            <span className={styles.statLabel}>Pass Rate</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
