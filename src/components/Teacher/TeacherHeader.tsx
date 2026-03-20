"use client";

import { Bell, Search, HelpCircle } from "lucide-react";
import styles from "./TeacherHeader.module.css";
import Image from "next/image";

interface TeacherHeaderProps {
    title: string;
    user: any;
}

export default function TeacherHeader({ title, user }: TeacherHeaderProps) {
    const initials = user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
        : "TR";

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <div className={styles.searchWrapper}>
                    <Search className={styles.searchIcon} size={18} />
                    <input type="text" placeholder="Search courses, students, videos..." className={styles.searchInput} />
                </div>
            </div>

            <div className={styles.right}>
                <button className={styles.iconBtn} title="Help">
                    <HelpCircle size={20} />
                </button>
                <button className={styles.iconBtn} title="Notifications">
                    <Bell size={20} />
                    <span className={styles.badge} />
                </button>
                
                <div className={styles.divider} />
                
                <div className={styles.profileBtn}>
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
                </div>
            </div>
        </header>
    );
}
