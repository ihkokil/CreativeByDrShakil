"use client";

import { useEffect, useState } from "react";
import styles from "./Upcoming.module.css";
import { motion } from "framer-motion";
import { Calendar, UserCheck } from "lucide-react";
import { COURSES } from "@/constants/courses";

export default function Upcoming() {
    const [timeLeft, setTimeLeft] = useState({
        days: 12,
        hours: 5,
        minutes: 45,
        seconds: 30,
    });

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
                if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59, minutes_val: prev.minutes - 1 };
                // Simple decrement for demo
                return { ...prev, seconds: 59 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <section className="section-padding">
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Featured Upcoming Course</h2>
                    <p className={styles.subtitle}>Our most anticipated batch is starting soon.</p>
                </div>

                <div className={styles.featuredBox}>
                    <div className={styles.timerWrapper}>
                        <div className={styles.timerLabel}>BATCH STARTS IN</div>
                        <div className={styles.timer}>
                            <div className={styles.timeUnit}>
                                <span>{timeLeft.days}</span>
                                <label>Days</label>
                            </div>
                            <div className={styles.timeUnit}>
                                <span>{timeLeft.hours}</span>
                                <label>Hours</label>
                            </div>
                            <div className={styles.timeUnit}>
                                <span>{timeLeft.minutes}</span>
                                <label>Mins</label>
                            </div>
                            <div className={styles.timerSeparator}>:</div>
                            <div className={styles.timeUnit}>
                                <span>{timeLeft.seconds}</span>
                                <label>Secs</label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.info}>
                            <span className={styles.category}>{COURSES[0].category}</span>
                            <h3>{COURSES[0].title}</h3>
                            <p>A comprehensive {COURSES[0].duration} program covering high-yield material designed specifically for postgraduate success.</p>

                            <div className={styles.meta}>
                                <div className={styles.metaItem}>
                                    <Calendar size={18} />
                                    <span>Commencing: April 15, 2026</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <UserCheck size={18} />
                                    <span>Only 8 Seats Left</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button className={styles.enrollBtn}>Register Now</button>
                            <button className={styles.detailsBtn}>View Syllabus</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
