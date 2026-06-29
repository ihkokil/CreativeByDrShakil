import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";

export const metadata: Metadata = {
    title: "Privacy Policy | Creative By Dr. Shakil",
    description: "Privacy Policy for Creative By Dr. Shakil.",
};

export default function PrivacyPolicy() {
    return (
        <>
            <Navbar />
            <main className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Privacy Policy</h1>
                    <p className={styles.subtitle}>Effective Date: {new Date().toLocaleDateString()}</p>
                </div>
                
                <div className={styles.content}>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>1. Introduction</h2>
                        <p className={styles.text}>
                            Welcome to <span className={styles.highlight}>Creative By Dr. Shakil</span> ("we," "our," or "us"). We are committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website (creativebydrshakil.com) and use our medical education platform and services.
                        </p>
                        <p className={styles.text}>
                            By accessing or using our platform, you signify that you have read, understood, and agree to our collection, storage, use, and disclosure of your personal information as described in this Privacy Policy.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>2. Information We Collect</h2>
                        <p className={styles.text}>
                            We may collect and process the following categories of personal data about you:
                        </p>
                        <ul className={styles.list}>
                            <li className={styles.listItem}><strong>Identity & Profile Data:</strong> First name, last name, username, medical credentials, educational background, profile picture, and account passwords.</li>
                            <li className={styles.listItem}><strong>Contact Data:</strong> Email address, billing address, and telephone numbers used for manual payment verification and essential communication.</li>
                            <li className={styles.listItem}><strong>Educational & Usage Data:</strong> Information about your progress in our courses, quiz scores, video watch time, and interaction with study materials.</li>
                            <li className={styles.listItem}><strong>Financial Data:</strong> Details of manual payments made, transaction IDs, and receipt screenshots submitted for verification. (Note: We do not directly collect or store credit card numbers as payments are handled offline or via third-party processors).</li>
                            <li className={styles.listItem}><strong>Technical Data:</strong> Internet Protocol (IP) address, browser type and version, time zone setting, operating system, and device information.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>3. How We Use Your Information</h2>
                        <p className={styles.text}>
                            We use the information we collect for the following purposes:
                        </p>
                        <ul className={styles.list}>
                            <li className={styles.listItem}>To provide, operate, and maintain our educational platform and deliver the courses you have purchased.</li>
                            <li className={styles.listItem}>To verify manual payments and grant appropriate access to premium content.</li>
                            <li className={styles.listItem}>To monitor and prevent unauthorized sharing of accounts, piracy, and to protect our intellectual property.</li>
                            <li className={styles.listItem}>To send administrative information, such as updates to our terms, security alerts, and support messages.</li>
                            <li className={styles.listItem}>To analyze usage trends and improve the quality and relevance of our medical education content.</li>
                        </ul>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>4. Data Security & Retention</h2>
                        <p className={styles.text}>
                            We implement industry-standard security measures, including encryption and secure server hosting, to protect your personal data from unauthorized access, alteration, or disclosure. However, no internet-based service is completely secure, and we cannot guarantee absolute security.
                        </p>
                        <p className={styles.text}>
                            We will retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy, or to comply with our legal, regulatory, or accounting obligations.
                        </p>
                    </section>
                    
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>5. Cookies and Tracking Technologies</h2>
                        <p className={styles.text}>
                            Our platform uses cookies and similar tracking technologies to track activity and hold certain information (like your login session and theme preferences). You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent, though some parts of our site may not function properly without them.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>6. Your Privacy Rights</h2>
                        <p className={styles.text}>
                            Depending on your location, you may have the right to request access to, correction of, or deletion of your personal data. You may also have the right to object to or restrict certain processing of your information. To exercise these rights, please contact us using the information below.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>7. Contact Us</h2>
                        <p className={styles.text}>
                            If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your personal data, please contact our administrative team directly.
                        </p>
                    </section>
                </div>
            </main>
            <Footer />
        </>
    );
}
