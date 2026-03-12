"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "../ThemeToggle/ThemeToggle";
import styles from "./Navbar.module.css";
import { ChevronDown, User, LayoutGrid, LogOut, Layout } from "lucide-react";
import AuthModal from "../Auth/AuthModal";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { CategorySummary, fetchCategories } from "@/lib/categories";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const { user, role, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const categoryMenuRef = useRef<HTMLDivElement | null>(null);

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
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAuthMode(authParam);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsAuthOpen(true);
        }
    }, [pathname]);

    useEffect(() => {
        let cancelled = false;

        const loadCategories = async () => {
            try {
                const list = await fetchCategories();
                if (!cancelled) {
                    setCategories(list);
                }
            } catch {
                // Keep the menu empty if the category request fails.
            }
        };

        loadCategories();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (categoryMenuRef.current && !categoryMenuRef.current.contains(event.target as Node)) {
                setIsCategoryOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                        <div className={styles.dropdown} ref={categoryMenuRef}>
                            <button className={styles.navBtn} onClick={() => setIsCategoryOpen((current) => !current)}>
                                <LayoutGrid size={18} />
                                Categories
                                <ChevronDown size={14} />
                            </button>
                            {isCategoryOpen && (
                                <div className={styles.dropdownMenu}>
                                    <Link href="/courses" className={styles.dropdownItem} onClick={() => setIsCategoryOpen(false)}>
                                        All Courses
                                    </Link>
                                    {categories.map((category) => (
                                        <Link
                                            key={category.id}
                                            href={`/courses?category=${encodeURIComponent(category.displayName)}`}
                                            className={styles.dropdownItem}
                                            onClick={() => setIsCategoryOpen(false)}
                                        >
                                            {category.displayName}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Link href="/courses" className={styles.link}>Courses</Link>
                        <Link href="/contact" className={styles.link}>Contact</Link>
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
