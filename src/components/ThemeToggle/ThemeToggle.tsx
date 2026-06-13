"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import styles from "./ThemeToggle.module.css";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem("theme");
        const resolvedTheme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
        setTheme(resolvedTheme);
        document.documentElement.setAttribute("data-theme", resolvedTheme);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("theme", theme);
    }, [mounted, theme]);

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
    };

    if (!mounted) {
        return <div className={styles.placeholder} aria-hidden="true" />;
    }

    return (
        <button
            className={`${styles.toggle} ${theme === "light" ? styles.light : styles.dark}`}
            onClick={toggleTheme}
            aria-label="Toggle Theme"
        >
            <motion.div
                className={styles.knob}
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
                {theme === "light" ? (
                    <Sun size={14} className={styles.sunIcon} />
                ) : (
                    <Moon size={14} className={styles.moonIcon} />
                )}
            </motion.div>

            <div className={styles.backgroundDecor}>
                <Sun size={12} className={styles.bgSun} />
                <Moon size={12} className={styles.bgMoon} />
            </div>
        </button>
    );
}
