"use client";

import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import styles from "./TeacherHeader.module.css";
import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

interface TeacherHeaderProps {
    title: string;
    user: any;
}

export default function TeacherHeader({ title, user }: TeacherHeaderProps) {
    const { signOut } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    const initials = user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : "TR";

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <h1 className={styles.title}>{title}</h1>
            </div>
            <div className={styles.right}>
                <div className={styles.themeWrapper}>
                    <ThemeToggle />
                </div>
                
                <div className={styles.divider} />
                
                <div className={styles.profileWrapper}>
                    <div className={styles.profileBtn} onClick={() => setIsOpen(!isOpen)}>
                        <div className={styles.profileText}>
                            <span className={styles.userName}>{user?.user_metadata?.full_name || "Instructor"}</span>
                            <span className={styles.userRole}>Premium Instructor</span>
                        </div>
                        <div className={styles.avatar}>
                            {user?.user_metadata?.profile_image ? (
                                <Image 
                                    src={user.user_metadata.profile_image} 
                                    alt={user.user_metadata.full_name || "Profile"} 
                                    fill 
                                    className={styles.avatarImg}
                                />
                            ) : (
                                initials
                            )}
                        </div>
                        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.open : ''}`} />
                    </div>

                    <AnimatePresence>
                        {isOpen && (
                            <>
                                <div className={styles.backdrop} onClick={() => setIsOpen(false)} />
                                <motion.div 
                                    className={styles.dropdown}
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <button className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
                                        <User size={18} />
                                        <span>My Profile</span>
                                    </button>
                                    <button className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
                                        <Settings size={18} />
                                        <span>Settings</span>
                                    </button>
                                    <div className={styles.dropdownDivider} />
                                    <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={signOut}>
                                        <LogOut size={18} />
                                        <span>Logout</span>
                                    </button>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}
