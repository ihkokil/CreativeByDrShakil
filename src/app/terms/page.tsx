import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";

export const metadata: Metadata = {
    title: "Terms of Service | Creative By Dr. Shakil",
    description: "Terms of Service for Creative By Dr. Shakil.",
};

export default function TermsOfService() {
    return (
        <>
            <Navbar />
            <main className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Terms of Service</h1>
                    <p className={styles.subtitle}>Effective Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <div className={styles.content}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
                        <p className={styles.text}>
                            By accessing, registering for, or using the <span className={styles.highlight}>Creative By Dr. Shakil</span> website and educational services, you agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions of this agreement, you may not access the website or use any services.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. Medical Education Disclaimer</h2>
                        <p className={styles.text}>
                            The content provided on this platform is strictly for <strong>educational and informational purposes only</strong>. It is designed to assist medical students and professionals in their studies and exam preparation.
                        </p>
                        <p className={styles.text}>
                            <strong>Not Medical Advice:</strong> The information contained in our courses, videos, and study materials should not be construed as professional medical advice, diagnosis, or treatment. Always consult official medical guidelines and your own clinical judgment when treating patients. We assume no liability for any medical decisions made based on the educational content provided here.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>3. Intellectual Property & Anti-Piracy Policy</h2>
                        <p className={styles.text}>
                            Our courses represent thousands of hours of professional work and expertise. We strictly enforce our intellectual property rights. By purchasing or accessing our courses, you agree to the following absolute restrictions:
                        </p>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><strong>No Recording or Capturing:</strong> You are strictly prohibited from using screen recording software, cameras, or any other capture methods to copy video, audio, or visual content.</li>
                            <li className={styles.listItem}><strong>No Distribution:</strong> You may not download, distribute, reproduce, transcribe, or publicly display any of our proprietary study materials, PDFs, or lecture notes.</li>
                            <li className={styles.listItem}><strong>No Account Sharing:</strong> Your account credentials are for your individual use only. Our systems monitor for suspicious login patterns and simultaneous access from different locations.</li>
                        </ul>
                        <p className={styles.text}>
                            <span className={styles.highlight}>Enforcement:</span> We reserve the right to immediately suspend or permanently terminate your account without warning or refund if we detect any violation of these anti-piracy terms. We also reserve the right to pursue legal action for copyright infringement.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>4. User Accounts and Registration</h2>
                        <p className={styles.text}>
                            To enroll in courses, you must create an account. You agree to provide accurate, current, and complete information, including your real name and professional/student credentials if requested. You are responsible for maintaining the confidentiality of your account password and for all activities that occur under your account.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>5. Payments and Access</h2>
                        <p className={styles.text}>
                            Payments for premium courses are currently processed manually and offline. Upon submitting your payment details and receipt, our administration team will review and verify the transaction. Access to the purchased content will only be granted once the payment has fully cleared. We reserve the right to refuse service or cancel orders at our sole discretion.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>6. Limitation of Liability</h2>
                        <p className={styles.text}>
                            In no event shall <span className={styles.highlight}>Creative By Dr. Shakil</span>, its instructors, directors, or employees, be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or use, arising out of or related to your use of the platform or the educational content provided.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>7. Changes to Terms</h2>
                        <p className={styles.text}>
                            We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will attempt to provide at least 15 days' notice prior to any new terms taking effect. Your continued use of the platform following the posting of any changes constitutes acceptance of those changes.
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
