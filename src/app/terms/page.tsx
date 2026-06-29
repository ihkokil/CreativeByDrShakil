import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Terms of Service | Creative By Dr. Shakil",
    description: "Terms of Service for Creative By Dr. Shakil.",
};

export default function TermsOfService() {
    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Terms of Service</h1>
                <p className={styles.subtitle}>Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className={styles.content}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
                    <p className={styles.text}>
                        By accessing and using <span className={styles.highlight}>Creative By Dr. Shakil</span>, you accept and agree to be bound by the terms and provision of this agreement.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. Intellectual Property & Anti-Piracy</h2>
                    <p className={styles.text}>
                        This is a premium course selling platform. We strictly enforce intellectual property rights. By purchasing or accessing our courses, you agree to the following:
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}><strong>No Recording:</strong> You are strictly prohibited from recording, screen-capturing, or downloading any video content, audio, or proprietary materials provided on this platform.</li>
                        <li className={styles.listItem}><strong>No Copying:</strong> You may not copy, reproduce, or transcribe course materials for distribution or personal gain.</li>
                        <li className={styles.listItem}><strong>No Stealing or Sharing:</strong> Account credentials and course access are for your personal use only. Sharing your account or distributing our content to others is considered theft.</li>
                    </ul>
                    <p className={styles.text}>
                        <span className={styles.highlight}>Violation Consequence:</span> Any violation of these terms will result in immediate termination of your account without a refund, and may result in legal action.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. User Accounts</h2>
                    <p className={styles.text}>
                        To access certain features of the platform, you may be required to register for an account. You agree to provide accurate, current, and complete information during the registration process and to update such information to keep it accurate, current, and complete.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Payments</h2>
                    <p className={styles.text}>
                        All payments for courses on this platform are processed manually and offline. Access to the purchased courses will be granted only after the payment has been fully verified and cleared by our administration team.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. Modifications to Service</h2>
                    <p className={styles.text}>
                        We reserve the right to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice. You agree that we shall not be liable to you or to any third party for any modification, suspension or discontinuance of the Service.
                    </p>
                </section>
            </div>
        </main>
    );
}
