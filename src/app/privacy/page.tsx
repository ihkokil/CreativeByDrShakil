import React from 'react';
import styles from '../legal.module.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Privacy Policy | Creative By Dr. Shakil",
    description: "Privacy Policy for Creative By Dr. Shakil.",
};

export default function PrivacyPolicy() {
    return (
        <main className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Privacy Policy</h1>
                <p className={styles.subtitle}>Last updated: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className={styles.content}>
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>1. Introduction</h2>
                    <p className={styles.text}>
                        Welcome to <span className={styles.highlight}>Creative By Dr. Shakil</span>. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>2. The Data We Collect About You</h2>
                    <p className={styles.text}>
                        We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                        <li className={styles.listItem}><strong>Contact Data</strong> includes billing address, email address and telephone numbers.</li>
                        <li className={styles.listItem}><strong>Transaction Data</strong> includes details about payments to and from you and other details of products or services you have purchased from us.</li>
                        <li className={styles.listItem}><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform, and other technology on the devices you use to access this website.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>3. How We Use Your Personal Data</h2>
                    <p className={styles.text}>
                        We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                        <li className={styles.listItem}>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                        <li className={styles.listItem}>Where we need to comply with a legal obligation.</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>4. Data Security</h2>
                    <p className={styles.text}>
                        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed. In addition, we limit access to your personal data to those employees, agents, contractors and other third parties who have a business need to know.
                    </p>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>5. Contact Details</h2>
                    <p className={styles.text}>
                        If you have any questions about this privacy policy or our privacy practices, please contact us.
                    </p>
                </section>
            </div>
        </main>
    );
}
