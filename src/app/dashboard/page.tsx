"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import styles from "./Dashboard.module.css";
import {
    LayoutDashboard,
    UserCog,
    TrendingUp,
    ClipboardList,
    BookOpen,
    Trophy,
    Clock,
    ArrowRight,
    Phone,
    User as UserIcon,
    Loader2
} from "lucide-react";
import { COURSES } from "@/constants/courses";
import Link from "next/link";
import Image from "next/image";
import StudentOverview from "@/components/Student/StudentOverview";

function StudentDashboardContent() {
    const { user, loading, refreshSession } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const activeTab = (searchParams.get("tab") as "overview" | "profile" | "progress" | "exams") || "overview";

    const setActiveTab = (tab: string) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };
    
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
            setPhone(user.user_metadata?.phone || user.phone || "");
        }
    }, [user]);

    const myCourses = useMemo(() => COURSES.slice(0, 3), []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/user/update-profile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ fullName, phone }),
        });
        const data = await response.json();

        if (!response.ok) {
            setMessage({ type: "error", text: data.error || "Failed to update profile." });
        } else {
            setMessage({ type: "success", text: "Profile updated successfully!" });
            await refreshSession();
        }

        setSaving(false);
    };

    if (loading || !user) {
        return (
            <div className={styles.loadingOverlay}>
                <Loader2 className={styles.spinner} />
                <span>Redirecting...</span>
            </div>
        );
    }

    return (
        <div className={styles.stack}>
            {activeTab === "overview" && (
                <>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h1 className={styles.sectionTitle}>Welcome back, {fullName.split(' ')[0]}!</h1>
                            <p className={styles.subtitle}>You're in the top 5% of active learners this week.</p>
                        </div>
                    </div>

                    <StudentOverview 
                        courseCount={myCourses.length}
                        completionPercent={45}
                        certificatesCount={12}
                        studyHours="24h"
                        onTabChange={setActiveTab}
                    />

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2>Recent Courses</h2>
                            <Link href="/courses" className={styles.inlineLink}>
                                Browse All <ArrowRight size={14} />
                            </Link>
                        </div>

                        <div className={styles.courseGrid}>
                            {myCourses.map((course) => (
                                <article key={course.id} className={styles.courseCard}>
                                    <div className={styles.thumb}>
                                        <Image src="/teacher-placeholder.jpg" alt={course.title} fill style={{ objectFit: "cover" }} />
                                    </div>
                                    <div className={styles.courseBody}>
                                        <span className={styles.category}>{course.category}</span>
                                        <h3>{course.title}</h3>
                                        <div className={styles.progressTrack}>
                                            <div className={styles.progressFill} style={{ width: "45%" }} />
                                        </div>
                                        <div className={styles.courseMeta}>
                                            <span>45% completed</span>
                                            <Link href="/study" className={styles.resumeBtn}>Resume</Link>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {activeTab === "profile" && (
                <section className={styles.panel}>
                    <div className={styles.panelHeader}>
                        <div>
                            <h2 className={styles.panelTitle}>Profile & Security</h2>
                            <p className={styles.subtitle}>Manage your identity and contact info</p>
                        </div>
                    </div>
                    
                    <form className={styles.profileForm} onSubmit={handleUpdateProfile}>
                        <div className={styles.formGroup}>
                            <label>Full Name</label>
                            <div className={styles.inputWrap}>
                                <UserIcon size={16} className={styles.inputIcon} />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Dr. John Doe"
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Email Address</label>
                            <input type="email" value={user.email || ""} disabled className={styles.disabledInput} />
                            <small>Email is linked to your academic record.</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Phone Number</label>
                            <div className={styles.inputWrap}>
                                <Phone size={16} className={styles.inputIcon} />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+8801XXXXXXXXX"
                                />
                            </div>
                        </div>

                        {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

                        <button type="submit" className={styles.primaryBtn} disabled={saving}>
                            {saving ? "Saving Changes..." : "Update Profile"}
                        </button>
                    </form>
                </section>
            )}

            {activeTab === "progress" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Progress Snapshot</h2>
                    <div className={styles.simpleCards}>
                        <div className={styles.simpleCard}><strong>18</strong><span>Lessons Completed</span></div>
                        <div className={styles.simpleCard}><strong>6</strong><span>Mock Tests Taken</span></div>
                        <div className={styles.simpleCard}><strong>3</strong><span>Courses On Track</span></div>
                    </div>
                </section>
            )}

            {activeTab === "exams" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Upcoming Exams</h2>
                    <div className={styles.examCards}>
                        <article className={styles.examCard}>
                            <h3>BCPS Part I Mock</h3>
                            <p>March 15 · Timed mock with analytics</p>
                        </article>
                        <article className={styles.examCard}>
                            <h3>Surgery Masterquiz</h3>
                            <p>March 28 · High-yield revision sprint</p>
                        </article>
                    </div>
                </section>
            )}
        </div>
    );
}

export default function StudentDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Dashboard...</div>}>
            <StudentDashboardContent />
        </Suspense>
    );
}
