"use client";
import ModuleLibraryManager from "@/components/Teacher/ModuleLibraryManager";
import styles from "../TeacherDashboard.module.css";

export default function LibraryPage() {
    return (
        <section className={styles.panelNoPad}>
            <ModuleLibraryManager />
        </section>
    );
}
