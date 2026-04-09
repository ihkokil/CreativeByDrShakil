"use client";

import { useEffect, useState } from "react";
import styles from "./Upcoming.module.css";
import { Calendar, UserCheck } from "lucide-react";
import { COURSES } from "@/constants/courses";

type FeaturedCourse = {
    title: string;
    category: string;
    duration: string;
    price: string;
    courseStartDate?: string | null;
};

export default function Upcoming() {
    const [timeLeft, setTimeLeft] = useState({
        days: 12,
        hours: 5,
        minutes: 45,
        seconds: 30,
    });
    const [featuredCourse, setFeaturedCourse] = useState<FeaturedCourse | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadFeaturedCourse = async () => {
            try {
                const response = await fetch("/api/courses/featured");
                const data = await response.json();
                if (!cancelled && response.ok) {
                    setFeaturedCourse(data.course || null);
                }
            } catch {
                // Keep the static fallback course if the featured lookup fails.
            }
        };

        loadFeaturedCourse();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
                if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
                // Simple decrement for demo
                return { ...prev, seconds: 59 };
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const course = featuredCourse || {
        title: COURSES[0].title,
        category: COURSES[0].category,
        duration: COURSES[0].duration,
        price: COURSES[0].price,
        courseStartDate: null,
    };

    const commencesLabel = course.courseStartDate
        ? `Commencing: ${new Date(course.courseStartDate).toLocaleDateString('en-GB')}`
        : "Commencing soon";

    return (
        <section className="section-padding alt-bg">
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
                            <span className={styles.category}>{course.category}</span>
                            <h3>{course.title}</h3>
                            <p>A comprehensive {course.duration} program covering high-yield material designed specifically for postgraduate success.</p>

                            <div className={styles.meta}>
                                <div className={styles.metaItem}>
                                    <Calendar size={18} />
                                    <span>{commencesLabel}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <UserCheck size={18} />
                                    <span>{course.price === "Free" ? "Free enrollment available" : `Featured course: ${course.price}`}</span>
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
