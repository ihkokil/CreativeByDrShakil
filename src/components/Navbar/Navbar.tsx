"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { User, LogOut, Layout, BookOpen, Mail, Menu, X, Home } from "lucide-react";
import AuthModal from "../Auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const { user, role, loading: authLoading, signOut } = useAuth();
    const [hasStoredToken, setHasStoredToken] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
    const navMenuRef = useRef<HTMLDivElement>(null);

    const dashboardHref = role === "admin"
        ? "/admin/dashboard"
        : role === "teacher"
            ? "/teacher/dashboard"
            : "/dashboard/courses";

    const getInitials = (name: string | undefined, fallback: string) => {
        if (!name) return fallback;
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const initials = getInitials(user?.user_metadata?.full_name, "US");

    useEffect(() => {
        if (typeof window !== "undefined") {
            setHasStoredToken(Boolean(localStorage.getItem("auth_token")));
        }
    }, [user]);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
                setIsNavMenuOpen(false);
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
            if (!user && !localStorage.getItem("auth_token")) {
                setAuthMode(authParam);
                setIsAuthOpen(true);
            }
        }
    }, [pathname, user]);

    useEffect(() => {
        if (isAuthOpen && (user || (typeof window !== "undefined" && localStorage.getItem("auth_token")))) {
            setIsAuthOpen(false);
        }
    }, [isAuthOpen, user]);

    const handleAccountClick = () => {
        if (user || (typeof window !== "undefined" && localStorage.getItem("auth_token"))) {
            router.push(dashboardHref);
            return;
        }
        setAuthMode("login");
        setIsAuthOpen(true);
    };


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
                    {/* Mobile Navigation Menu Button */}
                    <div className={styles.navMenuWrapper} ref={navMenuRef}>
                        <button
                            className={styles.navMenuBtn}
                            onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                            aria-label="Navigation Menu"
                        >
                            <Menu size={20} />
                        </button>

                        <AnimatePresence>
                            {isNavMenuOpen && (
                                <>
                                    <motion.button
                                        type="button"
                                        className={styles.navBackdrop}
                                        aria-label="Close navigation menu"
                                        onClick={() => setIsNavMenuOpen(false)}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                    <motion.div 
                                        className={styles.navSidePanel}
                                        initial={{ x: "-100%" }}
                                        animate={{ x: 0 }}
                                        exit={{ x: "-100%" }}
                                        transition={{ type: "tween", duration: 0.25, ease: "easeInOut" }}
                                    >
                                        <div className={styles.navPanelHeader}>
                                            <Link href="/" className={styles.navPanelLogo} onClick={() => setIsNavMenuOpen(false)}>
                                                <Image src="https://files.creativebydrshakil.com/logo/creative-by-dr-shakil-logo.svg" alt="Creative By Dr. Shakil" width={120} height={34} priority className={styles.logoImg} unoptimized />
                                            </Link>
                                            <button
                                                type="button"
                                                className={styles.navPanelCloseBtn}
                                                aria-label="Close navigation menu"
                                                onClick={() => setIsNavMenuOpen(false)}
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        <Link href="/" className={styles.navPanelLink} onClick={() => setIsNavMenuOpen(false)}>
                                            <Home size={18} /> Home
                                        </Link>
                                        <Link href="/courses" className={styles.navPanelLink} onClick={() => setIsNavMenuOpen(false)}>
                                            <BookOpen size={18} /> Courses
                                        </Link>
                                        <Link href="/contact" className={styles.navPanelLink} onClick={() => setIsNavMenuOpen(false)}>
                                            <Mail size={18} /> Contact
                                        </Link>

                                        {/* Logged-in user section in side panel */}
                                        {user && (
                                            <div className={styles.navPanelUserSection}>
                                                <div className={styles.navPanelUserInfo}>
                                                    <span className={styles.navPanelUserEmail}>{user.email}</span>
                                                    <span className={styles.navPanelUserRole}>{role}</span>
                                                </div>
                                                <Link
                                                    href={dashboardHref}
                                                    className={styles.navPanelLink}
                                                    onClick={() => setIsNavMenuOpen(false)}
                                                >
                                                    <Layout size={18} /> Dashboard
                                                </Link>
                                                <button
                                                    className={styles.navPanelLogout}
                                                    onClick={() => {
                                                        signOut();
                                                        setIsNavMenuOpen(false);
                                                    }}
                                                >
                                                    <LogOut size={18} /> Sign Out
                                                </button>
                                            </div>
                                        )}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <Link href="/" className={styles.logo}>
                        <Image src="https://files.creativebydrshakil.com/logo/creative-by-dr-shakil-logo.svg" alt="Creative By Dr. Shakil" width={140} height={40} priority className={styles.logoImg} unoptimized />
                    </Link>

                    <div className={styles.centerLinks}>
                        <Link href="/" className={styles.link} aria-label="Home">
                            <Home size={16} /> Home
                        </Link>
                        <Link href="/courses" className={styles.link}>
                            <BookOpen size={16} /> Courses
                        </Link>
                        <Link href="/contact" className={styles.link}>
                            <Mail size={16} /> Contact
                        </Link>
                    </div>

                    <div className={styles.rightActions}>
                        <ThemeToggle />

                        <div className={styles.userWrapper}>
                            {user || (authLoading && hasStoredToken) ? (
                                <Link
                                    href={dashboardHref}
                                    className={styles.userMenuBtn}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: 'var(--surface-soft)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: 'var(--primary)',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        border: '1px solid var(--glass-border)'
                                    }}>
                                        {user?.user_metadata?.profile_image ? (
                                            <Image 
                                                src={user.user_metadata.profile_image} 
                                                alt={user.user_metadata.full_name || "Profile"} 
                                                fill 
                                                style={{ objectFit: 'cover' }} 
                                                unoptimized
                                            />
                                        ) : (
                                            initials
                                        )}
                                    </div>
                                    <span className={styles.navText}>Account</span>
                                </Link>
                            ) : (
                                <button
                                    className={styles.accountBtn}
                                    onClick={handleAccountClick}
                                >
                                    <User size={18} />
                                    <span className={styles.navText}>Login / Register</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            
            <AuthModal 
                isOpen={isAuthOpen} 
                onClose={handleCloseAuth} 
                defaultMode={authMode} 
                onSuccess={(userRole) => {
                    if (userRole === "admin") {
                        router.push("/admin/dashboard");
                    } else if (userRole === "teacher") {
                        router.push("/teacher/dashboard");
                    } else {
                        router.push("/dashboard/courses");
                    }
                }}
            />
        </>
    );
}
