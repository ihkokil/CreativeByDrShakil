import Link from "next/link";
import { Home, BookOpen, Play, Pen } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

export default function MobileBottomNav() {
  return (
    <nav className={styles.bottomNav} aria-label="Mobile navigation">
      <Link href="/" className={styles.navItem} aria-label="Home">
        <Home size={20} />
        <span className={styles.label}>Home</span>
      </Link>
      <Link href="/dashboard?tab=courses" className={styles.navItem} aria-label="Courses">
        <BookOpen size={20} />
        <span className={styles.label}>Courses</span>
      </Link>
      <Link href="#" className={styles.navItem} aria-label="Live classes">
        <Play size={20} />
        <span className={styles.label}>Live</span>
      </Link>
      <Link href="#" className={styles.navItem} aria-label="Exams">
        <Pen size={20} />
        <span className={styles.label}>Exams</span>
      </Link>
    </nav>
  );
}
