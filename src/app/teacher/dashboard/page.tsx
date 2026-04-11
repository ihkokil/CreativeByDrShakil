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
