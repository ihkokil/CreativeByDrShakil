"use client";

import styles from "./CourseCard.module.css";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Star, Tag, User } from "lucide-react";
import { Course } from "@/constants/courses";
import { motion } from "framer-motion";

interface Props {
    course: Course;
    viewMode?: "grid" | "list";
}

export default function CourseCard({ course, viewMode = "grid" }: Props) {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -5 }}
            className={`${styles.card} ${viewMode === 'list' ? styles.listCard : ''} glass`}
        >
            <div className={styles.imageWrapper}>
                <Image
                    src="/placeholder.svg"
                    alt={course.title}
                    fill
                    style={{ objectFit: "cover" }}
                />
                <div className={styles.categoryBadge}>
                    <Tag size={12} />
                    {course.category}
                </div>
            </div>

            <div className={styles.cardInfo}>
                <div className={styles.instructorSection}>
                    <div className={styles.instructorAvatar}>
                        <Image src={course.mainInstructor.image} alt={course.mainInstructor.name} fill />
                    </div>
                    <span className={styles.instructorName}>{course.mainInstructor.name}</span>
                </div>

                <h3 className={styles.courseTitle}>{course.title}</h3>

                <div className={styles.meta}>
                    <div className={styles.metaItem}>
                        <BookOpen size={14} /> 24 Lessons
                    </div>
                    <div className={styles.metaItem}>
                        <Clock size={14} /> {course.duration}
                    </div>
                    <div className={styles.rating}>
                        <Star size={14} fill="currentColor" />
                        {course.rating}
                    </div>
                </div>
            </div>

            <div className={styles.cardFooter}>
                <span className={styles.price}>{course.price}</span>
                <Link href="/study" className={styles.enrollBtn}>
                    Enroll Now
                </Link>
            </div>
        </motion.div>
    );
}
