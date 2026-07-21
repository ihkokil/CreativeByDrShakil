"use client";
import BkashSettings from "@/components/Admin/BkashSettings";
import styles from "../../AdminDashboard.module.css";

export default function SettingsPage() {
    return (
        <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Platform Financials</h2>
            <BkashSettings />
        </section>
    );
}
