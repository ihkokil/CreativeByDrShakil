"use client";

import { useState } from "react";
import Link from "next/link";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { ChevronDown, User, LayoutGrid } from "lucide-react";

export default function Navbar() {
    return (
        <nav className={styles.navbar}>
            <div className={styles.container}>
                <Link href="/" className={styles.logo}>
                    <span className="gradient-text">Dr. Shakil's</span> Academy
                </Link>

                <div className={styles.centerLinks}>
                    <div className={styles.dropdown}>
                        <button className={styles.navBtn}>
                            <LayoutGrid size={18} />
                            Categories
                            <ChevronDown size={14} />
                        </button>
                    </div>
                    <Link href="/courses" className={styles.link}>Courses</Link>
                    <Link href="/exams" className={styles.link}>Mock Exams</Link>
                    <Link href="/resources" className={styles.link}>Resources</Link>
                </div>

                <div className={styles.rightActions}>
                    <ThemeToggle />
                    <button className={styles.accountBtn}>
                        <User size={18} />
                        Login
                    </button>
                </div>
            </div>
        </nav>
    );
}
