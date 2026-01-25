"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { COURSES } from "@/constants/courses";
import Link from "next/link";
import Image from "next/image";

export default function StudentDashboard() {
    const { user, loading, refreshSession, signOut } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<"overview" | "profile" | "progress" | "exams">("overview");
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
            return;
        }

        if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
            setPhone(user.user_metadata?.phone || user.phone || "");
        }
    }, [user, loading, router]);

    const navItems = useMemo(
        () => [
            { key: "overview", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
            { key: "profile", label: "Profile", icon: UserCog, mobilePrimary: true },
            { key: "progress", label: "Progress", icon: TrendingUp, mobilePrimary: true },
            { key: "exams", label: "Exams", icon: ClipboardList },
            { key: "user", label: "User Page", icon: UserCog },
        ],
        []
    );

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

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    if (loading || !user) {
        return <div className={styles.loader}>Loading Dashboard...</div>;
    }

    return (
        <DashboardShell
            title="Student Dashboard"
            subtitle="Track your courses, progress, and exam readiness from one place."
            roleLabel="Student"
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "Student"}
            userEmail={user.email}
            userAvatarUrl={user.user_metadata?.profile_image || null}
            items={navItems}
            activeKey={activeTab}
            onSelect={(key) => {
                if (key === "user") {
                    router.push("/dashboard/user");
                    return;
                }
                setActiveTab(key as "overview" | "profile" | "progress" | "exams");
            }}
            onLogout={handleLogout}
        >
            {activeTab === "overview" && (
                <div className={styles.stack}>
                    <section className={styles.metricsGrid}>
                        <div className={styles.metricCard}>
                            <Trophy size={20} />
                            <div>
                                <h3>12</h3>
                                <p>Certificates</p>
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <BookOpen size={20} />
                            <div>
                                <h3>{myCourses.length}</h3>
                                <p>Active Courses</p>
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <TrendingUp size={20} />
                            <div>
                                <h3>85%</h3>
                                <p>Average Score</p>
                            </div>
                        </div>
                        <div className={styles.metricCard}>
                            <Clock size={20} />
                            <div>
                                <h3>24h</h3>
                                <p>Study This Week</p>
                            </div>
                        </div>
                    </section>

                    <section className={styles.panel}>
                        <div className={styles.panelHeader}>
                            <h2>Continue Learning</h2>
                            <Link href="/courses" className={styles.inlineLink}>
                                Browse courses <ArrowRight size={14} />
                            </Link>
                        </div>

                        <div className={styles.courseGrid}>
                            {myCourses.map((course) => (
                                <article key={course.id} className={styles.courseCard}>
                                    <div className={styles.thumb}>
                                        <Image src="/placeholder.svg" alt={course.title} fill style={{ objectFit: "cover" }} />
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
                </div>
            )}

            {activeTab === "profile" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Profile Settings</h2>
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
                            <small>Email cannot be changed directly.</small>
                        </div>

                        <div className={styles.formGroup}>
                            <label>Phone Number</label>
                            <div className={styles.inputWrap}>
                                <Phone size={16} className={styles.inputIcon} />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 234 567 890"
                                />
                            </div>
                        </div>

                        {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

                        <button type="submit" className={styles.primaryBtn} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
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
        </DashboardShell>
    );
}
