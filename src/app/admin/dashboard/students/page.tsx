"use client";
import StudentsManager from "@/components/Shared/StudentsManager";
import styles from "../AdminDashboard.module.css";

export default function StudentsPage() {
    return (
        <div className={styles.pageShell}>
            <div className={styles.panelHeader} style={{ marginBottom: '8px' }}>
                <div>
                    <h2 className={styles.panelTitle}>Student Directory</h2>
                    <p className={styles.subtitle}>Enrolled students and user accounts</p>
                </div>
            </div>
            <StudentsManager />
        </div>
    );
}
