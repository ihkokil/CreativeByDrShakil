"use client";

import { motion } from "framer-motion";
import styles from "./Hero.module.css";
import { ArrowRight, MessageCircle, Star, Users } from "lucide-react";
import Image from "next/image";
import { COURSES } from "@/constants/courses";

export default function Hero() {
    const cards = [
        {
            id: 1,
            title: COURSES[0].title,
            tag: "Best Seller",
            x: -40, y: -60, rotate: -6,
            scale: 1,
            delay: 0.2
        },
        {
            id: 2,
            title: COURSES[1].title,
            tag: "High Yield",
            x: 60, y: 30, rotate: 4,
            scale: 0.95,
            delay: 0.4
        },
        {
            id: 3,
            title: COURSES[2].title,
            tag: "New",
            x: -80, y: 120, rotate: -2,
            scale: 0.9,
            delay: 0.6
        },
    ];

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
                            Admission Open for July 2026
                        </div>

                        <h1 className={styles.title}>
                            Transform Your <br />
                            <span className="gradient-text">Medical Career</span>
                        </h1>

                        <p className={styles.description}>
                            Join the most elite academy for FCPS and Residency prep. Our case-based approach and high-yield MCQ banks are designed by senior consultants to ensure your success.
                        </p>

                        <div className={styles.ctaGroup}>
                            <button className={styles.primaryBtn}>
                                Explore Courses <ArrowRight size={20} />
                            </button>
                            <button className={styles.secondaryBtn}>
                                <MessageCircle size={20} /> Contact Us
                            </button>
                        </div>

                        <div className={styles.socialProof}>
                            <div className={styles.avatars}>
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className={styles.avatar}>
                                        <Image src="/placeholder.svg" alt="Student" fill />
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
                        {cards.map((card) => (
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
                                    scale: card.scale + 0.05,
                                    y: card.y - 10,
                                    rotate: 0,
                                    zIndex: 20,
                                    transition: { duration: 0.3 }
                                }}
                            >
                                <div className={styles.cardTag}>{card.tag}</div>
                                <div className={styles.cardImage}>
                                    <Image src="/placeholder.svg" alt={card.title} fill />
                                </div>
                                <div className={styles.cardTitle}>{card.title}</div>
                                <div className={styles.cardStats}>
                                    <span><Users size={12} /> 400+</span>
                                    <span className={styles.rating}>4.9/5</span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
