"use client";

import { Bell, Search, GraduationCap } from "lucide-react";
import styles from "@/components/Teacher/TeacherHeader.module.css";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle/ThemeToggle";

interface StudentHeaderProps {
    title: string;
    user: any;
}

export default function StudentHeader({ title, user }: StudentHeaderProps) {
    const initials = user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : "ST";

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={18} />
                    <input type="text" placeholder="Search my courses, lessons, exams..." className={styles.searchInput} />
                </div>
            </div>

            <div className={styles.right}>
                <div className={styles.themeWrapper}>
                    <ThemeToggle />
                </div>
                <button className={styles.iconBtn} title="My Studies">
                    <GraduationCap size={20} />
                </button>
                <button className={styles.iconBtn} title="Notifications">
                    <Bell size={20} />
                    <span className={styles.badge} />
                </button>
                
                <div className={styles.divider} />
                
                <div className={styles.profileBtn}>
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
                </div>
            </div>
        </header>
    );
}
