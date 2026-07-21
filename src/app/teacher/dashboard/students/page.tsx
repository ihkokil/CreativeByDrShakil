"use client";
import StudentsManager from "@/components/Shared/StudentsManager";
import styles from "../TeacherDashboard.module.css";

export default function StudentsPage() {
    return (
        <section className={styles.panel}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Student Directory</h2>
                    <p className={styles.subtitle}>Enrolled students and user accounts</p>
                </div>
            </div>
            <StudentsManager />
        </section>
    );
}
