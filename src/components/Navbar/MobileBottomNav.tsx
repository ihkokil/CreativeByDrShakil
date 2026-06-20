"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Play, Pen } from "lucide-react";
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
        href="/dashboard?tab=courses"
        className={`${styles.navItem} ${pathname === "/dashboard" ? styles.active : ""}`}
        aria-label="Courses"
      >
        <BookOpen size={22} strokeWidth={pathname === "/dashboard" ? 2.5 : 1.8} />
        <span className={styles.label}>Courses</span>
      </Link>

      {/* Coming Soon — uncomment when ready
      <Link
        href="#"
        className={styles.navItem}
        aria-label="Live classes — coming soon"
      >
        <Play size={22} strokeWidth={1.8} />
        <span className={styles.label}>Live</span>
      </Link>

      <Link
        href="#"
        className={styles.navItem}
        aria-label="Exams — coming soon"
      >
        <Pen size={22} strokeWidth={1.8} />
        <span className={styles.label}>Exams</span>
      </Link>
      */}
    </nav>
  );
}
