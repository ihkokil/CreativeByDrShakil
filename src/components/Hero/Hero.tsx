"use client";

import { motion } from "framer-motion";
import styles from "./Hero.module.css";
import { ArrowRight, PlayCircle } from "lucide-react";

import Link from "next/link";
import Image from "next/image";

export default function Hero() {
    const cards = [
        { title: "BCPS Part I", color: "var(--primary)", delay: 0 },
        { title: "FCPS Surgery", color: "var(--secondary)", delay: 0.1 },
        { title: "Pediatrics", color: "var(--accent)", delay: 0.2 },
    ];

    return (
        <section className={styles.hero}>
            <div className={styles.content}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <span className={styles.badge}>Next Exam Cycle: July 2026</span>
                    <h1 className={styles.title}>
                        Excellence in <br />
                        <span className="gradient-text">Medical Education</span>
                    </h1>
                    <p className={styles.subtitle}>
                        Empowering residency candidates with professional MCQ banks, mock tests, and simplified concepts for FCPS & residency exams.
                    </p>
                    <div className={styles.actions}>
                        <button className={styles.primaryBtn}>
                            Select Course <ArrowRight size={18} />
                        </button>
                        <button className={styles.secondaryBtn}>
                            <PlayCircle size={18} /> Contact Us
                        </button>
                    </div>
                </motion.div>
            </div>

            <div className={styles.carouselContainer}>
                <div className={styles.stack}>
                    {cards.map((card, index) => (
                        <motion.div
                            key={index}
                            className={`${styles.card} glass`}
                            initial={{ opacity: 0, x: 100, rotate: index * 5 }}
                            animate={{ opacity: 1, x: 0, rotate: index * -5 }}
                            transition={{ delay: card.delay, duration: 0.8, ease: "easeOut" }}
                            whileHover={{
                                x: -50,
                                rotate: 0,
                                scale: 1.05,
                                zIndex: 10,
                                transition: { duration: 0.3 }
                            }}
                            style={{ zIndex: cards.length - index }}
                        >
                            <div className={styles.cardHeader} style={{ position: "relative", height: "140px" }}>
                                <Image
                                    src="/placeholder.svg"
                                    alt={card.title}
                                    fill
                                    style={{ objectFit: "cover" }}
                                />
                            </div>
                            <div className={styles.cardBody}>
                                <h3>{card.title}</h3>
                                <p>Latest high-yield question paper included.</p>
                                <div className={styles.cardFooter}>
                                    <span>4.9 ★</span>
                                    <span>1200+ Students</span>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
