"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { User, LogOut, Layout } from "lucide-react";
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
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

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
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const authParam = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("auth")
            : null;

        if (authParam === "login" || authParam === "register") {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAuthMode(authParam);
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                        <Link href="/courses" className={styles.link}>Courses</Link>
                        <Link href="/contact" className={styles.link}>Contact</Link>
                    </div>

                    <div className={styles.rightActions}>
                        <ThemeToggle />

                        {user ? (
                            <div className={styles.userWrapper} ref={userMenuRef}>
                                <button
                                    className={styles.userMenuBtn}
                                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                >
                                    <User size={20} />
                                    <span className={styles.navText}>Account</span>
                                </button>

                                {isUserMenuOpen && (
                                    <div className={styles.userDropdown}>
                                        <div className={styles.userHeader}>
                                            <span className={styles.userEmail}>{user.email}</span>
                                            <span className={styles.userRole}>{role}</span>
                                        </div>
                                        <Link
                                            href={dashboardHref}
                                            className={styles.dropdownLink}
                                            onClick={() => setIsUserMenuOpen(false)}
                                        >
                                            <Layout size={18} /> Dashboard
                                        </Link>
                                        <button
                                            className={styles.dropdownLogout}
                                            onClick={() => {
                                                signOut();
                                                setIsUserMenuOpen(false);
                                            }}
                                        >
                                            <LogOut size={18} /> Sign Out
                                        </button>
                                    </div>
                                )}
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
                                <span className={styles.navText}>Login</span>
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} defaultMode={authMode} />
        </>
    );
}
