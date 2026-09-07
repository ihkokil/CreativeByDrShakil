"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileQuestion, GraduationCap } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const cleanPath = pathname?.replace(/\/+$/, "") || "";

  const isAllCoursesActive = cleanPath === "/courses" || cleanPath.startsWith("/courses/");
  const isQuizActive = cleanPath === "/dashboard/quizzes";
  const isCoursesActive =
    cleanPath === "/dashboard" || cleanPath === "/dashboard/courses" || cleanPath.startsWith("/dashboard/courses/");

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      <Link
        href="/courses"
        className={`${styles.navItem} ${isAllCoursesActive ? styles.active : ""}`}
        aria-label="All Courses"
      >
        <BookOpen size={22} strokeWidth={isAllCoursesActive ? 2.5 : 1.8} />
        <span className={styles.label}>All Courses</span>
      </Link>

      <Link
        href="/dashboard/quizzes"
        className={`${styles.navItem} ${isQuizActive ? styles.active : ""}`}
        aria-label="Quiz"
      >
        <FileQuestion size={22} strokeWidth={isQuizActive ? 2.5 : 1.8} />
        <span className={styles.label}>Quiz</span>
      </Link>

      <Link
        href="/dashboard/courses"
        className={`${styles.navItem} ${isCoursesActive ? styles.active : ""}`}
        aria-label="Courses"
      >
        <GraduationCap size={22} strokeWidth={isCoursesActive ? 2.5 : 1.8} />
        <span className={styles.label}>Courses</span>
      </Link>
    </nav>
  );
}
