"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./VerifyEmail.module.css";

export default function VerifyEmailClient({ token }: { token: string }) {
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");
    const [countdown, setCountdown] = useState(5);
    const hasVerified = useRef(false);

    useEffect(() => {
        if (hasVerified.current) return;
        hasVerified.current = true;

        const verify = async () => {
            if (!token) {
                setStatus("error");
                setErrorMessage("Missing verification token.");
                return;
            }

            try {
                const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
                const data = await response.json();

                if (response.ok) {
                    setStatus("success");
                } else {
                    setStatus("error");
                    setErrorMessage(data.error || "Verification failed. The link may be expired.");
                }
            } catch {
                setStatus("error");
                setErrorMessage("Something went wrong. Please try again later.");
            }
        };

        verify();
    }, [token]);

    // Countdown + auto-redirect on success
    useEffect(() => {
        if (status !== "success") return;

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    router.push("/");
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [status, router]);

    return (
        <main className={styles.page}>
            {/* Decorative background elements */}
            <div className={styles.bgOrb1} />
            <div className={styles.bgOrb2} />

            <div className={styles.card}>
                {status === "loading" && (
                    <div className={styles.content}>
                        <div className={styles.spinnerWrap}>
                            <div className={styles.spinner} />
                        </div>
                        <h1 className={styles.title}>Verifying Your Email</h1>
                        <p className={styles.subtitle}>Please wait while we confirm your email address...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className={styles.content}>
                        <div className={styles.iconWrap}>
                            <div className={styles.successIcon}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" className={styles.checkmark} />
                                </svg>
                            </div>
                        </div>

                        <h1 className={styles.title}>Email Verified!</h1>
                        <p className={styles.subtitle}>
                            Your account has been successfully verified. You can now log in and start learning.
                        </p>

                        {/* Device Lock Warning */}
                        <div className={styles.infoCard}>
                            <div className={styles.infoHeader}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>Important — Device Policy</span>
                            </div>
                            <div className={styles.infoBody}>
                                <div className={styles.ruleRow}>
                                    <div className={styles.ruleIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                            <line x1="8" y1="21" x2="16" y2="21" />
                                            <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                    </div>
                                    <p>You can log in from <strong>1 Desktop/Laptop</strong> and <strong>1 Mobile</strong> device at a time.</p>
                                </div>
                                <div className={styles.ruleRow}>
                                    <div className={styles.ruleIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                            <line x1="12" y1="18" x2="12.01" y2="18" />
                                        </svg>
                                    </div>
                                    <p>The <strong>first browser</strong> you use on each device will be <strong>locked</strong> to your account.</p>
                                </div>
                                <div className={styles.ruleRow}>
                                    <div className={styles.ruleIcon}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </div>
                                    <p>To switch browsers or devices, contact an <strong>admin to release the lock</strong>.</p>
                                </div>
                            </div>
                        </div>

                        {/* Countdown + redirect */}
                        <div className={styles.redirectBar}>
                            <div className={styles.progressTrack}>
                                <div
                                    className={styles.progressFill}
                                    style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                                />
                            </div>
                            <p className={styles.redirectText}>
                                Redirecting to homepage in <strong>{countdown}s</strong>...
                            </p>
                        </div>

                        <button
                            className={styles.homeBtn}
                            onClick={() => router.push("/")}
                        >
                            Go to Homepage Now
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </button>
                    </div>
                )}

                {status === "error" && (
                    <div className={styles.content}>
                        <div className={styles.iconWrap}>
                            <div className={styles.errorIcon}>
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </div>
                        </div>

                        <h1 className={styles.title}>Verification Failed</h1>
                        <p className={styles.subtitle}>{errorMessage}</p>

                        <button
                            className={styles.homeBtn}
                            onClick={() => router.push("/")}
                        >
                            Go to Homepage
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
