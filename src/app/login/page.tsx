"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/components/Auth/Auth.module.css";
import pageStyles from "../auth/AuthPages.module.css";
import { resolveEmail } from "@/lib/email-resolver";
import { normalizeLoginIdentifier } from "@/lib/login-validator";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";

type PageStep = "email" | "password";

function LoginContent() {
    const { refreshSession } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [step, setStep] = useState<PageStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Prefill email if it comes from search params
    useEffect(() => {
        const emailParam = searchParams.get("email");
        if (emailParam) {
            setEmail(emailParam);
            setMessage({
                type: "success",
                text: "An account with this email already exists. Please log in.",
            });
        }
    }, [searchParams]);

    const handleEmailSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const result = normalizeLoginIdentifier(email);
        if (!result.valid) {
            setMessage({ type: "error", text: result.reason });
            return;
        }
        const resolved = result.email;

        setLoading(true);
        setMessage(null);

        try {
            const checkResponse = await fetch("/api/auth/check-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resolved }),
            });
            const checkData = await checkResponse.json();

            if (!checkResponse.ok) {
                setMessage({ type: "error", text: checkData.error || "Failed to check email." });
                setLoading(false);
                return;
            }

            if (checkData.exists) {
                setStep("password");
            } else {
                const otpResponse = await fetch("/api/auth/send-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: resolved }),
                });
                const otpData = await otpResponse.json();

                if (!otpResponse.ok) {
                    setMessage({
                        type: "error",
                        text: otpData.error || "Account does not exist, and we failed to send a verification code for registration.",
                    });
                } else {
                    setMessage({
                        type: "success",
                        text: "Account does not exist. We sent a verification code to your email. Redirecting to register...",
                    });
                    setTimeout(() => {
                        router.push(`/register?email=${encodeURIComponent(resolved)}&otpSent=true`);
                    }, 1500);
                }
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier: resolveEmail(email.trim()), password }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: "error", text: data.error || "Invalid credentials." });
            } else {
                if (data.token) {
                    localStorage.setItem("auth_token", data.token);
                }
                await refreshSession();
                setMessage({ type: "success", text: "Successfully logged in!" });

                const userRole = data.user?.role || "student";
                setTimeout(() => {
                    if (userRole === "admin") {
                        router.push("/admin/dashboard");
                    } else if (userRole === "teacher") {
                        router.push("/teacher/dashboard");
                    } else {
                        router.push("/dashboard?tab=courses");
                    }
                }, 1000);
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={pageStyles.page}>
            <section className={`${styles.modal} glass`} style={{ position: "relative" }}>
                {step !== "email" && (
                    <button
                        className={styles.backBtn}
                        onClick={() => {
                            setStep("email");
                            setMessage(null);
                            setPassword("");
                        }}
                        type="button"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {step === "email" ? "Welcome " : "Enter "}
                        <span className="gradient-text">
                            {step === "email" ? "Guest!" : "Password"}
                        </span>
                    </h2>
                    <p className={styles.subtitle}>
                        {step === "email" ? "Enter your email to sign in or get started." : "Access your courses and progress."}
                    </p>
                </div>

                <form
                    className={styles.form}
                    onSubmit={step === "email" ? handleEmailSubmit : handlePasswordSubmit}
                    noValidate
                >
                    {step === "email" && (
                        <div className={styles.inputGroup}>
                            <Mail className={styles.inputIcon} size={18} />
                            <input
                                type="text"
                                inputMode="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                name="email"
                                autoComplete="username"
                                required
                            />
                        </div>
                    )}

                    {step === "password" && (
                        <>
                            <div className={styles.emailDisplay}>
                                <Mail size={16} />
                                <span>{email}</span>
                            </div>
                            <div className={styles.inputGroup}>
                                <Lock className={styles.inputIcon} size={18} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className={styles.eyeBtn}
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            <div className={styles.forgotWrap}>
                                <Link href="/forgot-password" className={styles.forgotLink}>
                                    Forgot password?
                                </Link>
                            </div>
                        </>
                    )}

                    {message && (
                        <div className={`${styles.message} ${styles[message.type]}`}>
                            {message.text}
                        </div>
                    )}

                    <button className={styles.submitBtn} disabled={loading}>
                        {step === "email" ? (
                            <>
                                {loading ? "Checking email..." : "Continue"}
                                {!loading && <ArrowRight size={18} />}
                            </>
                        ) : (
                            <>
                                {loading ? "Logging in..." : "Login Now"}
                                {!loading && <ArrowRight size={18} />}
                            </>
                        )}
                    </button>
                </form>

                {step === "email" && (
                    <>
                        <div className={styles.divider}>
                            <span>OR</span>
                        </div>

                        <div className={styles.socialBar}>
                            <button
                                type="button"
                                className={styles.socialBtn}
                                onClick={() => {
                                    window.location.href = "/api/auth/nextauth";
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: "10px" }}>
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </button>
                        </div>
                    </>
                )}

                <p className={styles.toggleText}>
                    New here?
                    <Link href="/register" style={{ color: "var(--primary)", fontWeight: 700, marginLeft: "5px" }}>
                        Create account
                    </Link>
                </p>
            </section>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <main className={pageStyles.page}>
                <section className={`${styles.modal} glass`} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                    <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading...</p>
                </section>
            </main>
        }>
            <LoginContent />
        </Suspense>
    );
}
