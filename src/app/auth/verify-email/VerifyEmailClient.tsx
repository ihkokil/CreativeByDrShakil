"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../AuthPages.module.css";

export default function VerifyEmailClient({ token }: { token: string }) {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string }>({
        type: "success",
        text: "Verifying your email...",
    });

    useEffect(() => {
        const verify = async () => {
            if (!token) {
                setMessage({ type: "error", text: "Missing verification token." });
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: data.message || "Email verified successfully." });
                
                // Redirect logic
                const redirectPath = localStorage.getItem("post_verify_redirect");
                if (redirectPath) {
                    localStorage.removeItem("post_verify_redirect");
                    setTimeout(() => {
                        window.location.href = redirectPath;
                    }, 2000);
                }
            } else {
                setMessage({ type: "error", text: data.error || "Verification failed." });
            }

            setLoading(false);
        };

        verify();
    }, [token]);

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <h1 className={styles.title}>Email Verification</h1>
                <p className={styles.subtitle}>Complete your account verification to continue.</p>

                <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>

                {!loading && (
                    <div className={styles.linkRow}>
                        <Link href="/" className={styles.link}>Go to home</Link>
                    </div>
                )}
            </section>
        </main>
    );
}
