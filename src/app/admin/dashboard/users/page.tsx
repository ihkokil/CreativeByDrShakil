"use client";
import UsersManager from "@/components/Shared/UsersManager";
import styles from "../../AdminDashboard.module.css";

export default function UsersPage() {
    return (
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
                <div>
                    <h2 className={styles.panelTitle}>User Directory</h2>
                    <p className={styles.subtitle}>Active device sessions and enrolled programs</p>
                </div>
            </div>
            <UsersManager />
        </section>
    );
}
