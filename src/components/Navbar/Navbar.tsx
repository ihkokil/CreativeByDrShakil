"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { ChevronDown, User, LayoutGrid } from "lucide-react";
import AuthModal from "../Auth/AuthModal";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <>
            <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}>
                        <Image src="/logo.png" alt="Dr. Shakil's Academy" width={160} height={45} priority className={styles.logoImg} />
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
                        <button className={styles.accountBtn} onClick={() => setIsAuthOpen(true)}>
                            <User size={18} />
                            Login
                        </button>
                    </div>
                </div>
            </nav>

            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
        </>
    );
}
