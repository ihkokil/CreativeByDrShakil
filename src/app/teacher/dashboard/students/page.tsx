"use client";
import StudentsManager from "@/components/Shared/StudentsManager";
import styles from "../TeacherDashboard.module.css";

export default function StudentsPage() {
    return (
        <section className={styles.panel} aria-label="Student Directory & Enrollment Hub">
            <div className={styles.sectionHeader} style={{ marginBottom: '16px' }}>
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
        </section>
    );
}

