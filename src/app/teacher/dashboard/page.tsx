"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import TeacherOverview from "@/components/Teacher/TeacherOverview";
import VideoLibraryManager from "@/components/Teacher/VideoLibraryManager";
import CoursesTab from "@/components/Teacher/CoursesTab";
import styles from "./TeacherDashboard.module.css";
import Image from "next/image";

function TeacherDashboardContent() {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const activeTab = (searchParams.get("tab") as any) || "overview";

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div className={styles.loader}>Loading Teacher Dashboard...</div>;
    }

    return (
        <div className={styles.stack}>
            {activeTab === "overview" && (
                <TeacherOverview />
            )}

            {activeTab === "courses" && (
                <CoursesTab />
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
        </div>
    );
}

export default function TeacherDashboard() {
    return (
        <Suspense fallback={<div className={styles.loader}>Loading Teacher Dashboard...</div>}>
            <TeacherDashboardContent />
        </Suspense>
    );
}
