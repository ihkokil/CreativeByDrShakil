"use client";
import StudentsManager from "@/components/Shared/StudentsManager";
import styles from "../TeacherDashboard.module.css";

export default function StudentsPage() {
    return (
        <div className={styles.pageShell} aria-label="Student Directory & Enrollment Hub">
            <div className={styles.sectionHeader} style={{ marginBottom: '8px' }}>
                <div>
                    <h1 className={styles.sectionTitle} style={{ fontSize: '1.65rem', letterSpacing: '-0.02em', margin: 0 }}>
                        Student Directory
                    </h1>
                    <p className={styles.subtitle} style={{ marginTop: '4px' }}>
                        Enrolled medical students, cohort access rules, and individual study progress.
                    </p>
                </div>
            </div>
            <StudentsManager />
        </div>
    );
}

