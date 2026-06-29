import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Refund Policy | Creative By Dr. Shakil",
    description: "Refund Policy for Creative By Dr. Shakil.",
};

export default function RefundPolicy() {
    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Refund Policy</h1>
                <p className={styles.subtitle}>Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className={styles.content}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Manual and Offline Payments</h2>
                    <p className={styles.text}>
                        At <span className={styles.highlight}>Creative By Dr. Shakil</span>, all transactions for our premium courses are processed manually and offline. Because of the nature of these payments and the immediate access to digital premium content upon approval, our refund procedures are strictly regulated.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Refund Eligibility</h2>
                    <p className={styles.text}>
                        Refunds are generally not provided once access to the course content has been granted. We highly recommend reviewing the course descriptions and curriculum carefully before making a payment.
                    </p>
                    <p className={styles.text}>
                        Exceptions may be made in extremely rare circumstances (e.g., duplicate manual payments). Any such exceptions are strictly at the discretion of the administration.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. How to Request a Refund or Dispute</h2>
                    <p className={styles.text}>
                        If you believe you have a valid reason to request a refund or if there is an issue with your manual payment, you must contact us directly.
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}><strong>Contact Person:</strong> Dr. Nahid Akhter Shakil</li>
                        <li className={styles.listItem}><strong>Process:</strong> Please reach out via our official communication channels provided upon your registration or through our contact page with your payment receipt and reasoning.</li>
                        <li className={styles.listItem}><strong>Timeline:</strong> Refund requests, if applicable, must be submitted within 3 days of the original transaction date.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Course Revocation</h2>
                    <p className={styles.text}>
                        In the event that a refund is approved and processed, your access to the corresponding course(s) and any associated materials will be immediately revoked.
                    </p>
                </section>
            </div>
        </main>
    );
}
