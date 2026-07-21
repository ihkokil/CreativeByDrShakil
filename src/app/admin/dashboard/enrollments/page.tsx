"use client";
import EnrollmentsManager from "@/components/Shared/EnrollmentsManager";
import styles from "../../AdminDashboard.module.css";

export default function EnrollmentsPage() {
    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>Enrollments Manager</h2>
                    <p className={styles.subtitle}>Manage student course enrollments and progress.</p>
                </div>
            </div>
            <EnrollmentsManager />
        </section>
    );
}
