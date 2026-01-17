"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import styles from "./TeacherDashboard.module.css";
import {
    LayoutDashboard,
    BookOpen,
    Users,
    ClipboardList,
    Video,
    DollarSign,
    Star,
    CheckCircle,
} from "lucide-react";
import { COURSES } from "@/constants/courses";
import VideoLibraryManager from "@/components/Teacher/VideoLibraryManager";
import Image from "next/image";

export default function TeacherDashboard() {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "courses" | "students" | "assignments" | "library">("overview");

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    const navItems = useMemo(
        () => [
            { key: "overview", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
            { key: "courses", label: "Courses", icon: BookOpen, mobilePrimary: true },
            { key: "students", label: "Students", icon: Users, mobilePrimary: true },
            { key: "assignments", label: "Assignments", icon: ClipboardList },
            { key: "library", label: "Library", icon: Video },
        ],
        []
    );

    if (loading || !user) {
        return <div className={styles.loader}>Loading Teacher Dashboard...</div>;
    }

    const teacherName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Dr. Shakil Ahmed";
    const myCourses = COURSES.filter(
        (course) =>
            course.mainInstructor.name === teacherName ||
            course.subInstructors?.some((ins) => ins.name === teacherName)
    );
    const fallbackCourses = myCourses.length > 0 ? myCourses : [COURSES[1], COURSES[5], COURSES[6]];

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    return (
        <DashboardShell
            title="Teacher Dashboard"
            subtitle="Manage your courses, students, and content library in one app shell."
            roleLabel="Teacher"
            userName={teacherName}
            userEmail={user.email}
            items={navItems}
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as "overview" | "courses" | "students" | "assignments" | "library")}
            onLogout={handleLogout}
        >
            {activeTab === "overview" && (
                <div className={styles.stack}>
                    <section className={styles.metricsGrid}>
                        <div className={styles.metricCard}><DollarSign size={20} /><div><h3>৳1,25,000</h3><p>Total Revenue</p></div></div>
                        <div className={styles.metricCard}><Users size={20} /><div><h3>842</h3><p>Active Students</p></div></div>
                        <div className={styles.metricCard}><Star size={20} /><div><h3>4.9</h3><p>Average Rating</p></div></div>
                        <div className={styles.metricCard}><BookOpen size={20} /><div><h3>{fallbackCourses.length}</h3><p>Courses</p></div></div>
                    </section>

                    <section className={styles.panel}>
                        <h2 className={styles.panelTitle}>Your Courses</h2>
                        <div className={styles.courseGrid}>
                            {fallbackCourses.map((course) => (
                                <article key={course.id} className={styles.courseCard}>
                                    <div className={styles.thumb}>
                                        <Image src="/placeholder.svg" alt={course.title} fill style={{ objectFit: "cover" }} />
                                    </div>
                                    <div className={styles.courseBody}>
                                        <span className={styles.category}>{course.category}</span>
                                        <h3>{course.title}</h3>
                                        <div className={styles.metaRow}>
                                            <span><Users size={14} /> 120 Students</span>
                                            <span><CheckCircle size={14} /> 85% Completion</span>
                                        </div>
                                        <button className={styles.primaryBtn}>Manage Content</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {activeTab === "courses" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Course Management</h2>
                    <div className={styles.simpleCards}>
                        <div className={styles.simpleCard}><strong>8</strong><span>Draft Modules</span></div>
                        <div className={styles.simpleCard}><strong>24</strong><span>Published Lessons</span></div>
                        <div className={styles.simpleCard}><strong>3</strong><span>Requires Review</span></div>
                    </div>
                </section>
            )}

            {activeTab === "students" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Student Analytics</h2>
                    <div className={styles.simpleCards}>
                        <div className={styles.simpleCard}><strong>842</strong><span>Total Active Students</span></div>
                        <div className={styles.simpleCard}><strong>76%</strong><span>Weekly Retention</span></div>
                        <div className={styles.simpleCard}><strong>91%</strong><span>Assignment Submission</span></div>
                    </div>
                </section>
            )}

            {activeTab === "assignments" && (
                <section className={styles.panel}>
                    <h2 className={styles.panelTitle}>Assignment Center</h2>
                    <div className={styles.assignmentList}>
                        <article className={styles.assignmentCard}><h3>Clinical Case Reflection</h3><p>32 pending reviews · due in 2 days</p></article>
                        <article className={styles.assignmentCard}><h3>Rapid Revision Quiz</h3><p>18 pending reviews · due in 4 days</p></article>
                    </div>
                </section>
            )}

            {activeTab === "library" && (
                <section className={styles.panelNoPad}>
                    <VideoLibraryManager />
                </section>
            )}
        </DashboardShell>
    );
}
