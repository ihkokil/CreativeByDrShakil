"use client";

import { motion } from "framer-motion";
import styles from "./Hero.module.css";
import { ArrowRight, MessageCircle, Star, Users } from "lucide-react";
import Image from "next/image";
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
                // Fallback handled by empty state or CSS cards
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const defaultCards = [
        { id: '1', title: "FCPS Part 1 Preparation", tag: "Best Seller", x: -40, y: -60, rotate: -6, scale: 1, delay: 0.2 },
        { id: '2', title: "Residency Intensive Care", tag: "High Yield", x: 60, y: 30, rotate: 4, scale: 0.95, delay: 0.4 },
        { id: '3', title: "MRCP Part 1 Foundation", tag: "New", x: -80, y: 120, rotate: -2, scale: 0.9, delay: 0.6 },
    ];

    const displayCourses = courses.length >= 3 ? courses.map((c, i) => ({
        ...c,
        ...defaultCards[i]
    })) : defaultCards;

    return (
        <section className={styles.hero}>
            {/* Background Decorative Elements */}
            <div className={styles.glow1}></div>
            <div className={styles.glow2}></div>

            <div className={styles.container}>
                <div className={styles.content}>
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                    >
                        <div className={styles.badge}>
                            <span className={styles.pulse}></span>
                            Admission Open for 2026 Batches
                        </div>

                        <h1 className={styles.title}>
                            Transform Your <br />
                            <span className="gradient-text">Medical Career</span>
                        </h1>

                        <p className={styles.description}>
                            Join the most elite academy for FCPS and Residency prep. Our case-based approach and high-yield MCQ banks are designed by senior consultants to ensure your success.
                        </p>

                        <div className={styles.ctaGroup}>
                            <Link href="/courses">
                                <button className={styles.primaryBtn}>
                                    Explore Courses <ArrowRight size={20} />
                                </button>
                            </Link>
                            <Link href="/contact">
                                <button className={styles.secondaryBtn}>
                                    <MessageCircle size={20} /> Contact Us
                                </button>
                            </Link>
                        </div>

                        <div className={styles.socialProof}>
                            <div className={styles.avatars}>
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className={styles.avatar}>
                                        <Image src="/placeholder-square.svg" alt="Student" fill />
                                    </div>
                                ))}
                                <div className={styles.avatarPlus}>+2k</div>
                            </div>
                            <div className={styles.proofText}>
                                <div className={styles.stars}>
                                    {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={14} fill="currentColor" />)}
                                </div>
                                <span>Trusted by 2,000+ Doctors</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className={styles.visualSide}>
                    <div className={styles.floatingGrid}>
                        {displayCourses.map((card: any) => (
                            <motion.div
                                key={card.id}
                                className={`${styles.floatingCard} glass`}
                                initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
                                animate={{
                                    opacity: 1,
                                    scale: card.scale,
                                    x: card.x,
                                    y: card.y,
                                    rotate: card.rotate
                                }}
                                transition={{
                                    delay: card.delay,
                                    duration: 1,
                                    ease: "backOut"
                                }}
                                whileHover={{
                                    scale: card.scale + 0.1,
                                    y: card.y - 12,
                                    rotate: 0,
                                    zIndex: 20,
                                    transition: { duration: 0.3 }
                                }}
                            >
                                <div className={styles.cardTag}>{card.tag}</div>
                                <div className={styles.cardImage}>
                                    <Image src={card.image || "/placeholder.svg"} alt={card.title} fill />
                                </div>
                                <div className={styles.cardTitle}>{card.title}</div>
                                <div className={styles.cardStats}>
                                    <span><Users size={12} /> 400+</span>
                                    <span className={styles.rating}>4.9/5</span>
                                </div>
                                {card.slug && (
                                    <Link href={`/courses/${card.slug}`} className={styles.cardLink} />
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
