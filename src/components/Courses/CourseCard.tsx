"use client";

import styles from "./CourseCard.module.css";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, Star, User } from "lucide-react";
import { Course } from "@/constants/courses";


interface Props {
    course: Course;
    viewMode?: "grid" | "list";
}

export default function CourseCard({ course, viewMode = "grid" }: Props) {
    return (
        <div className={`${styles.card} ${viewMode === 'list' ? styles.listCard : ''} glass`}>
            <Link href={`/courses/${course.slug}`} className={styles.imageWrapper}>
                <Image
                    src={course.image || "/placeholder.svg"}
                    alt={course.title}
                    fill
                    style={{ objectFit: "cover" }}
                    unoptimized
                />
            </Link>

            <div className={styles.cardInfo}>
                <div className={styles.instructorSection}>
                    <div className={styles.instructorAvatar}>
                        <Image src={course.mainInstructor.image || "/placeholder-square.svg"} alt={course.mainInstructor.name} fill unoptimized />
                    </div>
                    <span className={styles.instructorName}>{course.mainInstructor.name}</span>
                </div>

                <Link href={`/courses/${course.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 className={styles.courseTitle}>{course.title}</h3>
                </Link>

                <div className={styles.meta}>
                    <div className={styles.metaItem}>
                        <BookOpen size={14} /> {course.lessonCount || 0} Lessons
                    </div>
                    <div className={styles.metaItem}>
                        <Clock size={14} /> {course.duration}
                    </div>

                </div>
            </div>

            <div className={styles.cardFooter}>
                <div className={styles.priceContainer}>
                    {course.originalPrice && (
                        <span className={styles.originalPrice}>{course.originalPrice}</span>
                    )}
                    <span className={styles.price}>{course.price}</span>
                </div>
                <Link href={`/courses/${course.slug}`} className={styles.enrollBtn}>
                    View Details
                </Link>
            </div>
        </div>
    );
}
