"use client";

import { Users, Clock, Star, Globe } from "lucide-react";
import styles from "./CourseHero.module.css";
import { Course } from "@/constants/courses";

interface Props {
  course: Course;
}

export default function CourseHero({ course }: Props) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.info}>
          <div className={styles.badge}>{course.category || "General"}</div>
          <h1 className={styles.title}>{course.title}</h1>
          
          <div className={styles.metadata}>
            <div className={styles.metaItem}>
              <Star size={18} className={styles.metaIcon} fill="currentColor" />
              <span><strong>{course.rating.toFixed(1)}</strong> Course Rating</span>
            </div>
            {typeof course.enrolledCount === 'number' && course.enrolledCount > 0 && (
              <div className={styles.metaItem}>
                <Users size={18} className={styles.metaIcon} />
                <span><strong>{course.enrolledCount.toLocaleString()}+</strong> Students</span>
              </div>
            )}
            <div className={styles.metaItem}>
              <Clock size={18} className={styles.metaIcon} />
              <span>{course.duration}</span>
            </div>
            {course.language && (
                <div className={styles.metaItem}>
                    <Globe size={18} className={styles.metaIcon} />
                    <span>{course.language}</span>
                </div>
            )}
          </div>
        </div>
        
        {/* Reservation for Sidebar positioning or extra visual content */}
        <div className={styles.visualSide} />
      </div>
    </section>
  );
}
