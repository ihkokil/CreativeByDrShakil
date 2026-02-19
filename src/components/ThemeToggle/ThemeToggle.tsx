"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
        <motion.button
            className={styles.toggle}
            onClick={toggleTheme}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            aria-label="Toggle Theme"
        >
            <div className={styles.iconContainer}>
                <AnimatePresence mode="wait" initial={false}>
                    {theme === "light" ? (
                        <motion.div
                            key="sun"
                            initial={{ y: 20, rotate: 45, opacity: 0 }}
                            animate={{ y: 0, rotate: 0, opacity: 1 }}
                            exit={{ y: -20, rotate: -45, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "backOut" }}
                        >
                            <Sun size={20} className={styles.sunIcon} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="moon"
                            initial={{ y: 20, rotate: -45, opacity: 0 }}
                            animate={{ y: 0, rotate: 0, opacity: 1 }}
                            exit={{ y: -20, rotate: 45, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "backOut" }}
                        >
                            <Moon size={20} className={styles.moonIcon} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.button>
    );
}
