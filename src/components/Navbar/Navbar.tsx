"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { ChevronDown, User, LayoutGrid, LogOut, Layout } from "lucide-react";
import AuthModal from "../Auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const { user, role, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const dashboardHref = role === "admin"
        ? "/admin/dashboard"
        : role === "teacher"
            ? "/teacher/dashboard"
            : "/dashboard";

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const authParam = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("auth")
            : null;

        if (authParam === "login" || authParam === "register") {
            setAuthMode(authParam);
            setIsAuthOpen(true);
        }
    }, [pathname]);

    const handleCloseAuth = () => {
        setIsAuthOpen(false);

        const hasAuthParam = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).has("auth")
            : false;

        if (hasAuthParam) {
            router.replace(pathname);
        }
    };

    return (
        <>
            <nav className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}>
                <div className={styles.container}>
                    <Link href="/" className={styles.logo}>
                        <Image src="/logo.png" alt="Creative By Dr. Shakil" width={160} height={45} priority className={styles.logoImg} />
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

                        {user ? (
                            <div className={styles.userSection}>
                                <Link href={dashboardHref} className={styles.dashboardLink}>
                                    <Layout size={18} /> Dashboard
                                </Link>
                                <button className={styles.logoutBtn} onClick={() => signOut()}>
                                    <LogOut size={18} />
                                </button>
                            </div>
                        ) : (
                            <button
                                className={styles.accountBtn}
                                onClick={() => {
                                    setAuthMode("login");
                                    setIsAuthOpen(true);
                                }}
                            >
                                <User size={18} />
                                Login
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} defaultMode={authMode} />
        </>
    );
}
