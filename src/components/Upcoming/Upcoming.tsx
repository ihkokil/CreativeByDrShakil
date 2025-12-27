"use client";

import styles from "./Upcoming.module.css";
import { motion } from "framer-motion";

const upcoming = [
    { title: "Gastroenterology Crash Course", date: "April 15", seats: 12 },
    { title: "FCPS II Surgery Viva Secrets", date: "May 02", seats: 5 },
    { title: "ECG Mastery for Residency", date: "June 20", seats: 45 },
];

export default function Upcoming() {
    return (
        <section className="section-padding" style={{ background: "rgba(59, 130, 246, 0.02)" }}>
            <div className={styles.header}>
                <h2 className={styles.title}>Upcoming Live Courses</h2>
                <p className={styles.subtitle}>Reserved seats are filling up fast. Register early to secure your spot.</p>
            </div>

            <div className={styles.list}>
                {upcoming.map((course, index) => (
                    <motion.div
                        key={index}
                        className={`${styles.item} glass`}
                        whileHover={{ scale: 1.02 }}
                    >
                        <div className={styles.info}>
                            <h3>{course.title}</h3>
                            <p>Commencing {course.date}</p>
                        </div>
                        <div className={styles.status}>
                            <span className={styles.seats}>{course.seats} Seats Left</span>
                            <button className={styles.remindBtn}>Notify Me</button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}
