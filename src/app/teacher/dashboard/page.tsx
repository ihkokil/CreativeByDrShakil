"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import styles from "./TeacherDashboard.module.css";
import {
    Users,
    BookOpen,
    DollarSign,
    Star,
    Plus,
    BarChart3,
    MessageSquare,
    CheckCircle,
    ArrowRight,
    Search,
    BookMarked
} from "lucide-react";
import { motion } from "framer-motion";
import { COURSES, INSTRUCTORS } from "@/constants/courses";
import Image from "next/image";
import Link from "next/link";
import VideoLibraryManager from "@/components/Teacher/VideoLibraryManager";

export default function TeacherDashboard() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'students' | 'assignments' | 'library'>('overview');

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div className={styles.loader}>Loading Teacher Dashboard...</div>;
    }

    // Mock teacher data (assume Dr. Shakil for demonstration if metadata not set)
    const teacherName = user.user_metadata?.full_name || "Dr. Shakil Ahmed";
    const myCourses = COURSES.filter(course =>
        course.mainInstructor.name === teacherName ||
        course.subInstructors?.some(ins => ins.name === teacherName)
    ).length > 0 ? COURSES.filter(course =>
        course.mainInstructor.name === teacherName ||
        course.subInstructors?.some(ins => ins.name === teacherName)
    ) : [COURSES[1], COURSES[5], COURSES[6]]; // Default mock for demo

    const stats = [
        { label: "Total Revenue", value: "৳1,25,000", icon: <DollarSign size={24} />, color: "#8b5cf6" },
        { label: "Active Students", value: "842", icon: <Users size={24} />, color: "#ec4899" },
        { label: "Avg. Course Rating", value: "4.9", icon: <Star size={24} />, color: "#f59e0b" },
        { label: "Total Lessons", value: "156", icon: <BookOpen size={24} />, color: "#10b981" },
    ];

    const recentActivity = [
        { id: 1, type: 'enrollment', user: 'Dr. Rahul', course: 'Surgery High Yield', time: '2 mins ago' },
        { id: 2, type: 'review', user: 'Dr. Sarah', course: 'Anatomy Foundation', time: '1 hour ago', rating: 5 },
        { id: 3, type: 'submission', user: 'Dr. Faisal', course: 'Viva Secrets', time: '3 hours ago' },
    ];

    return (
        <main className={styles.main}>
            <Navbar />

            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.welcome}>
                        <h1>Instructor <span className="gradient-text">Dashboard</span></h1>
                        <p>Welcome back, {teacherName}. Here&apos;s what&apos;s happening with your courses.</p>
                    </div>
                    <div className={styles.stats}>
                        {stats.map((stat, index) => (
                            <div key={index} className={styles.statCard}>
                                <div className={styles.statIcon} style={{ color: stat.color }}>
                                    {stat.icon}
                                </div>
                                <div>
                                    <h3>{stat.value}</h3>
                                    <label>{stat.label}</label>
                                </div>
                            </div>
                        ))}
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
                        className={`${styles.tabBtn} ${activeTab === 'courses' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('courses')}
                    >
                        My Courses
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'students' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('students')}
                    >
                        Students
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'assignments' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('assignments')}
                    >
                        Assignments
                    </button>
                    <button
                        className={`${styles.tabBtn} ${activeTab === 'library' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('library')}
                    >
                        Video Library
                    </button>
                </div>

                {activeTab === 'overview' && (
                    <div className={styles.dashboardGrid}>
                        <section className={styles.mainContent}>
                            <div className={styles.sectionHeader}>
                                <h2>Your <span className="gradient-text">Courses</span></h2>
                                <Link href="#" className={styles.viewAll}>View Analysis <ArrowRight size={16} /></Link>
                            </div>

                            <div className={styles.courseList}>
                                {myCourses.map(course => (
                                    <motion.div
                                        key={course.id}
                                        className={styles.courseCard}
                                        whileHover={{ y: -5 }}
                                    >
                                        <div className={styles.courseThumb}>
                                            <Image src="/placeholder.svg" alt={course.title} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div className={styles.courseInfo}>
                                            <span className={styles.category}>{course.category}</span>
                                            <h3>{course.title}</h3>
                                            <div className={styles.courseStats}>
                                                <div className={styles.courseStat}>
                                                    <Users size={14} /> 120 Students
                                                </div>
                                                <div className={styles.courseStat}>
                                                    <CheckCircle size={14} /> 85% Comp.
                                                </div>
                                            </div>
                                            <button className={styles.manageBtn}>Manage Content</button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </section>

                        <aside className={styles.sidebar}>
                            <button className={styles.createCourseBtn}>
                                <Plus size={20} /> Create New Course
                            </button>

                            <div className={styles.sidebarCard}>
                                <h3>Recent Activity</h3>
                                <div className={styles.activityList}>
                                    {recentActivity.map(activity => (
                                        <div key={activity.id} className={styles.activityItem}>
                                            <div className={styles.activityIcon}>
                                                {activity.type === 'enrollment' ? <Users size={18} /> :
                                                    activity.type === 'review' ? <Star size={18} /> :
                                                        <BookMarked size={18} />}
                                            </div>
                                            <div className={styles.activityInfo}>
                                                <h4>{activity.user}</h4>
                                                <p>{activity.type === 'enrollment' ? 'Enrolled in' :
                                                    activity.type === 'review' ? 'Reviewed' :
                                                        'Submitted assignment for'} {activity.course}</p>
                                                <span>{activity.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.sidebarCard}>
                                <h3>Messages</h3>
                                <div className={styles.activityList}>
                                    <div className={styles.activityItem}>
                                        <div className={styles.activityIcon}>
                                            <MessageSquare size={18} />
                                        </div>
                                        <div className={styles.activityInfo}>
                                            <h4>Academic Support</h4>
                                            <p>You have 3 new questions from students.</p>
                                            <span>Just now</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>
                )}

                {activeTab === 'courses' && (
                    <div className={styles.profileSection}>
                        <h2>Course <span className="gradient-text">Management</span></h2>
                        <p>This is where you can create, edit, and publish your medical courses.</p>
                        {/* More detailed course management UI could go here */}
                    </div>
                )}

                {activeTab === 'students' && (
                    <div className={styles.profileSection}>
                        <h2>Student <span className="gradient-text">Analytics</span></h2>
                        <p>Track student progress, attendance, and exam performance across all your courses.</p>
                    </div>
                )}

                {activeTab === 'assignments' && (
                    <div className={styles.profileSection}>
                        <h2>Assignment <span className="gradient-text">Grading</span></h2>
                        <p>Review and grade submissions from your students.</p>
                    </div>
                )}

                {activeTab === 'library' && (
                    <VideoLibraryManager />
                )}
            </div>

            <Footer />
        </main>
    );
}
