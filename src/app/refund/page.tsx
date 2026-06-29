import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";

export const metadata: Metadata = {
    title: "Refund Policy | Creative By Dr. Shakil",
    description: "Refund Policy for Creative By Dr. Shakil.",
};

export default function RefundPolicy() {
    return (
        <>
            <Navbar />
            <main className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Refund Policy</h1>
                    <p className={styles.subtitle}>Effective Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <div className={styles.content}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>1. Digital Content Nature</h2>
                        <p className={styles.text}>
                            At <span className={styles.highlight}>Creative By Dr. Shakil</span>, we provide premium medical education content that is delivered digitally. Due to the immediate access to proprietary knowledge, video lectures, and downloadable study resources upon enrollment, our refund policy is strictly enforced.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. General "No Refund" Policy</h2>
                        <p className={styles.text}>
                            Because our products are digital and intellectual property is immediately consumed upon access, <strong>we generally do not offer refunds</strong> once a course has been purchased and access has been granted to your account.
                        </p>
                        <p className={styles.text}>
                            We strongly encourage all prospective students to carefully review the course syllabus, free preview materials (if available), and course descriptions to ensure the content meets their educational needs before making a manual payment.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>3. Exceptions & Special Circumstances</h2>
                        <p className={styles.text}>
                            We understand that administrative errors can occasionally occur. Refunds will only be considered under the following rare circumstances:
                        </p>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><strong>Duplicate Payments:</strong> If you accidentally submit a manual payment multiple times for the exact same course.</li>
                            <li className={styles.listItem}><strong>Technical Failure Prior to Access:</strong> If a technical error on our end permanently prevents you from accessing the course you paid for, and our support team cannot resolve the issue within a reasonable timeframe.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>4. Manual Payment Verification</h2>
                        <p className={styles.text}>
                            Since all payments are processed manually and offline, any request to cancel an enrollment must be made <strong>before</strong> our administration team verifies your payment receipt and activates your course access. Once access is activated, the transaction is considered final.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>5. How to Request a Refund</h2>
                        <p className={styles.text}>
                            If you believe your situation falls under one of our stated exceptions, you must submit a formal refund request.
                        </p>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><strong>Direct Contact:</strong> Please contact <strong>Dr. Nahid Akhter Shakil</strong> or our primary administrative support directly.</li>
                            <li className={styles.listItem}><strong>Required Information:</strong> Include your full name, registered email, course name, proof of duplicate payment (transaction IDs/screenshots), and a detailed explanation of the issue.</li>
                            <li className={styles.listItem}><strong>Timeline:</strong> Any dispute or request must be submitted within 3 days of the original transaction date.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>6. Consequence of Refund</h2>
                        <p className={styles.text}>
                            In the event that a refund is approved and processed by our administration, your access to the corresponding course(s) and any associated platform materials will be revoked immediately and permanently.
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
