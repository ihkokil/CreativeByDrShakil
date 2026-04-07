"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../AuthPages.module.css";

export default function ResetPasswordClient({ token }: { token: string }) {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage(null);

        if (!token) {
            setMessage({ type: "error", text: "Missing reset token." });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
        }

        setLoading(true);

        const response = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password }),
        });
        const data = await response.json();

        if (response.ok) {
            setMessage({ type: "success", text: data.message || "Password updated. You can now log in." });
            setPassword("");
            setConfirmPassword("");
            redirectTimerRef.current = setTimeout(() => {
                router.replace("/?auth=login");
            }, 1000);
        } else {
            setMessage({ type: "error", text: data.error || "Unable to reset password." });
        }

        setLoading(false);
    };

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <h1 className={styles.title}>Reset Password</h1>
                <p className={styles.subtitle}>Set a new password for your account.</p>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <input
                        className={styles.input}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        required
                    />
                    <input
                        className={styles.input}
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                    />
                    <button className={styles.button} disabled={loading}>
                        {loading ? "Resetting..." : "Reset Password"}
                    </button>
                </form>

                {message ? <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div> : null}

                <div className={styles.linkRow}>
                    <Link href="/" className={styles.link}>Back to home</Link>
                </div>
            </section>
        </main>
    );
}
