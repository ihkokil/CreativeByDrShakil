"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import styles from "./Dashboard.module.css";
import { BookOpen, Clock, Star, Trophy, ArrowRight, Play, User as UserIcon, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { COURSES } from "@/constants/courses";
import Image from "next/image";
import Link from "next/link";

export default function StudentDashboard() {
    const { user, loading, refreshSession } = useAuth();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'overview' | 'profile'>('overview');
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        } else if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split('@')[0] || "");
            setPhone(user.user_metadata?.phone || user.phone || "");
        }
    }, [user, loading, router]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/user/update-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ fullName, phone }),
        });
        const data = await response.json();
        
        if (!response.ok) {
            setMessage({ type: 'error', text: data.error || 'Failed to update profile.' });
        } else {
            setMessage({ type: 'success', text: 'Profile updated successfully!' });
            await refreshSession();
        }
        setSaving(false);
    };

    if (loading || !user) {
        return <div className={styles.loader}>Loading Dashboard...</div>;
    }

    const myCourses = [COURSES[0], COURSES[1]]; // Mock data for enrolled courses

    return (
        <main className={styles.main}>
            <Navbar />

            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.welcome}>
                        <h1>Welcome back, <span className="gradient-text">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Doctor'}</span></h1>
                        <p>You have 2 courses currently in progress. Keep up the momentum!</p>
                    </div>
                    <div className={styles.stats}>
                        <div className={styles.statCard}>
                            <Trophy className={styles.statIcon} />
                            <div>
                                <h3>12</h3>
                                <label>Certificates</label>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <BookOpen className={styles.statIcon} />
                            <div>
                                <h3>85%</h3>
                                <label>Avg. Score</label>
                            </div>
                        </div>
                    </div>
                </header>

                <div className={styles.tabNav}>
                    <button 
                        className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button 
                        className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile Settings
                    </button>
                </div>

                {activeTab === 'overview' ? (
                    <div className={styles.dashboardGrid}>
                    {/* Left Column: My Courses */}
                    <section className={styles.myCourses}>
                        <div className={styles.sectionHeader}>
                            <h2>My <span className="gradient-text">Courses</span></h2>
                            <Link href="/courses" className={styles.viewAll}>Find more <ArrowRight size={16} /></Link>
                        </div>

                        <div className={styles.courseList}>
                            {myCourses.map(course => (
                                <motion.div
                                    key={course.id}
                                    className={`${styles.courseCard} glass`}
                                    whileHover={{ y: -5 }}
                                >
                                    <div className={styles.courseThumb}>
                                        <Image src="/placeholder.svg" alt={course.title} fill style={{ objectFit: 'cover' }} />
                                        <div className={styles.playOverlay}>
                                            <Play fill="white" size={30} />
                                        </div>
                                    </div>
                                    <div className={styles.courseInfo}>
                                        <span className={styles.category}>{course.category}</span>
                                        <h3>{course.title}</h3>
                                        <div className={styles.progressContainer}>
                                            <div className={styles.progressBar} style={{ width: '45%' }}></div>
                                        </div>
                                        <div className={styles.courseMeta}>
                                            <span>45% Completed</span>
                                            <Link href="/study" className={styles.resumeBtn}>Resume</Link>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </section>

                    {/* Right Column: Sidebar info */}
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarCard}>
                            <h3>Upcoming Exams</h3>
                            <div className={styles.examList}>
                                <div className={styles.examItem}>
                                    <div className={styles.date}>Mar 15</div>
                                    <div className={styles.examTitle}>BCPS Part I Mock</div>
                                </div>
                                <div className={styles.examItem}>
                                    <div className={styles.date}>Mar 28</div>
                                    <div className={styles.examTitle}>Surgery Masterquiz</div>
                                </div>
                            </div>
                            <button className={styles.sidebarBtn}>View All Exams</button>
                        </div>

                        <div className={`${styles.sidebarCard} ${styles.blueCard}`}>
                            <h3>Need help?</h3>
                            <p>Our academic advisors are available 10am - 8pm for clinical guidance.</p>
                            <button className={styles.supportBtn}>Contact Support</button>
                        </div>
                    </aside>
                </div>
                ) : (
                    <div className={`${styles.profileSection} glass`}>
                        <h2>Profile <span className="gradient-text">Settings</span></h2>
                        <form className={styles.profileForm} onSubmit={handleUpdateProfile}>
                            <div className={styles.formGroup}>
                                <label>Full Name</label>
                                <div className={styles.inputWrapper}>
                                    <UserIcon size={18} className={styles.inputIcon} />
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
                                <div className={styles.inputWrapper}>
                                    <input 
                                        type="email" 
                                        value={user?.email || ""}
                                        disabled
                                        className={styles.disabledInput}
                                    />
                                </div>
                                <span className={styles.helpText}>Email cannot be changed directly.</span>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Phone Number</label>
                                <div className={styles.inputWrapper}>
                                    <Phone size={18} className={styles.inputIcon} />
                                    <input 
                                        type="tel" 
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+1 234 567 890"
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button type="submit" className={styles.saveBtn} disabled={saving}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <Footer />
        </main>
    );
}
