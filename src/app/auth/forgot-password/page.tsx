"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../AuthPages.module.css";
import { resolveEmail, validateEmail } from "@/lib/email-resolver";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setMessage({ type: "error", text: "Email address is required." });
            return;
        }

        const resolved = resolveEmail(trimmedEmail);
        if (!validateEmail(resolved)) {
            if (trimmedEmail.includes("@")) {
                setMessage({ type: "error", text: "Please enter a valid email address." });
            } else {
                setMessage({ type: "error", text: "Please enter a valid username." });
            }
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resolved }),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: data.message || "Check your email for reset instructions." });
            } else {
                setMessage({ type: "error", text: data.error || "Unable to process request." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <h1 className={styles.title}>Forgot Password</h1>
                <p className={styles.subtitle}>Enter your email and we will send you a reset link.</p>

                <form className={styles.form} onSubmit={handleSubmit} noValidate>
                    <input
                        className={styles.input}
                        type="text"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                    />
                    <button className={styles.button} disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>
                </form>

                {message ? <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div> : null}

                <div className={styles.linkRow}>
                    <Link href="/" className={styles.link}>Back to home</Link>
                </div>
                <div className={styles.linkRow}>
                    <Link href="/?auth=login" className={styles.link}>Sign in</Link>
                </div>
            </section>
        </main>
    );
}
