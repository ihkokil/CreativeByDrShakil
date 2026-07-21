"use client";
import EnrollmentsManager from "@/components/Shared/EnrollmentsManager";
import styles from "../TeacherDashboard.module.css";

export default function EnrollmentsPage() {
    return (
        <section className={styles.panel}>
            <div className={styles.sectionHeader}>
                <div>
                    <h2 className={styles.sectionTitle}>Bulk Enrollment Manager</h2>
                    <p className={styles.subtitle}>Select multiple students to batch assign courses.</p>
                </div>
            </div>
            <EnrollmentsManager />
        </section>
    );
}
