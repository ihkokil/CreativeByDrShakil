"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, FileQuestion } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      <Link
        href="/"
        className={`${styles.navItem} ${pathname === "/" ? styles.active : ""}`}
        aria-label="Home"
      >
        <Home size={22} strokeWidth={pathname === "/" ? 2.5 : 1.8} />
        <span className={styles.label}>Home</span>
      </Link>

      <Link
        href="/dashboard/quizzes"
        className={`${styles.navItem} ${pathname.startsWith("/dashboard/quizzes") ? styles.active : ""}`}
        aria-label="Quiz"
      >
        <FileQuestion size={22} strokeWidth={pathname.startsWith("/dashboard/quizzes") ? 2.5 : 1.8} />
        <span className={styles.label}>Quiz</span>
      </Link>

      <Link
        href="/dashboard/courses"
        className={`${styles.navItem} ${pathname.startsWith("/dashboard/courses") ? styles.active : ""}`}
        aria-label="Courses"
      >
        <BookOpen size={22} strokeWidth={pathname.startsWith("/dashboard/courses") ? 2.5 : 1.8} />
        <span className={styles.label}>Courses</span>
      </Link>
    </nav>
  );
}
