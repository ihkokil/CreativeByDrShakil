"use client";

import Image from "next/image";
import { MonitorPlay, FileText, PlayCircle, Users, CheckCircle2 } from "lucide-react";
import styles from "./CourseSidebar.module.css";
import { Course } from "@/constants/courses";

interface Props {
  course: Course;
  progressLoading: boolean;
  userEnrolled: boolean;
  courseStarted: boolean;
  onEnterCourse: () => void;
  onEnroll: () => void;
}

export default function CourseSidebar({ 
  course, 
  progressLoading, 
  userEnrolled, 
  courseStarted,
  onEnterCourse,
  onEnroll
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.imageWrapper}>
        <Image
          src={course.image || "/placeholder.svg"}
          alt={course.title}
          fill
          style={{ objectFit: "cover" }}
          unoptimized
        />
      </div>
      
      <div className={styles.content}>
        <div className={styles.priceRow}>
          {course.originalPrice && (
            <div className={styles.originalPrice}>{course.originalPrice}</div>
          )}
          <div className={styles.price}>{course.price === "Free" ? "Free" : course.price}</div>
        </div>

        <div className={styles.buttons}>
          {progressLoading ? (
            <button className={styles.btn} disabled>Loading...</button>
          ) : userEnrolled ? (
            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={onEnterCourse}
            >
              <MonitorPlay size={20} />
              {courseStarted ? "Continue Course" : "Start Course"}
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.primaryBtn}`}
              onClick={onEnroll}
            >
              <CheckCircle2 size={20} />
              Enroll Now
            </button>
          )}
        </div>

        <div className={styles.includes}>
          <h4 className={styles.includesTitle}>This course includes:</h4>
          <ul className={styles.includesList}>
            <li className={styles.includesItem}>
              <MonitorPlay size={18} className={styles.icon} />
              <span>1 year of access</span>
            </li>
            <li className={styles.includesItem}>
              <FileText size={18} className={styles.icon} />
              <span>Comprehensive study materials</span>
            </li>
            <li className={styles.includesItem}>
              <PlayCircle size={18} className={styles.icon} />
              <span>On-demand video content</span>
            </li>
            <li className={styles.includesItem}>
              <Users size={18} className={styles.icon} />
              <span>Direct instructor support</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
