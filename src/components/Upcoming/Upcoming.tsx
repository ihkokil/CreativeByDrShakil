"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./Upcoming.module.css";
import { Calendar, UserCheck } from "lucide-react";
import { formatDisplayDate } from "@/lib/date-format";

type FeaturedCourse = {
    title: string;
    category: string;
    duration: string;
    price: string;
    courseStartDate?: string | null;
};

export default function Upcoming() {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });
    const [featuredCourse, setFeaturedCourse] = useState<FeaturedCourse | null>(null);

    const calculateTimeLeft = useCallback((targetDate: string | null) => {
        if (!targetDate) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
        
        const difference = +new Date(targetDate) - +new Date();
        let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }

        return timeLeft;
    }, []);

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
                // Fallback handled below
            }
        };

        loadFeaturedCourse();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            if (featuredCourse?.courseStartDate) {
                setTimeLeft(calculateTimeLeft(featuredCourse.courseStartDate));
            } else {
                // If no date, use a placeholder countdown that looks realistic (e.g. end of week)
                const now = new Date();
                const nextSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()));
                setTimeLeft(calculateTimeLeft(nextSunday.toISOString()));
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [featuredCourse, calculateTimeLeft]);

    const course = featuredCourse || {
        title: "Medical Excellence Program",
        category: "General",
        duration: "Self-paced",
        price: "Free",
        courseStartDate: null,
    };

    const commencesLabel = course.courseStartDate
        ? `Commencing: ${formatDisplayDate(course.courseStartDate)}`
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
                                <span>{String(timeLeft.days).padStart(2, '0')}</span>
                                <label>Days</label>
                            </div>
                            <div className={styles.timeUnit}>
                                <span>{String(timeLeft.hours).padStart(2, '0')}</span>
                                <label>Hours</label>
                            </div>
                            <div className={styles.timeUnit}>
                                <span>{String(timeLeft.minutes).padStart(2, '0')}</span>
                                <label>Mins</label>
                            </div>
                            <div className={styles.timerSeparator}>:</div>
                            <div className={styles.timeUnit}>
                                <span>{String(timeLeft.seconds).padStart(2, '0')}</span>
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
