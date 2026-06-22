"use client";

import { User, Settings, LogOut, ChevronDown, Menu } from "lucide-react";
import styles from "@/components/Teacher/TeacherHeader.module.css";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

interface StudentHeaderProps {
    title: string;
    user: any;
    onToggleSidebar?: () => void;
}

export default function StudentHeader({ title, user, onToggleSidebar }: StudentHeaderProps) {
    const { signOut } = useAuth();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    const getInitials = (name: string, fallback: string) => {
        if (!name) return fallback;
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    const initials = getInitials(user?.user_metadata?.full_name, "ST");

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                {onToggleSidebar && (
                    <button className={styles.menuBtn} onClick={onToggleSidebar} aria-label="Toggle Sidebar">
                        <Menu size={20} />
                    </button>
                )}
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
                            <span className={styles.userName}>{user?.user_metadata?.full_name || "Learner"}</span>
                            <span className={styles.userRole}>Student Account</span>
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
                                    <button 
                                        className={styles.dropdownItem} 
                                        onClick={() => {
                                            setIsOpen(false);
                                            router.push("/dashboard?tab=profile");
                                        }}
                                    >
                                        <User size={18} />
                                        <span>My Profile</span>
                                    </button>
                                    <button 
                                        className={styles.dropdownItem} 
                                        onClick={() => {
                                            setIsOpen(false);
                                            router.push("/dashboard?tab=security");
                                        }}
                                    >
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
