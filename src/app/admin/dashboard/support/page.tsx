"use client";
import ContactRequestsManager from "@/components/Admin/ContactRequestsManager";
import styles from "../AdminDashboard.module.css";

export default function SupportPage() {
    return (
        <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Inbound Help Requests</h2>
            <ContactRequestsManager />
        </section>
    );
}
