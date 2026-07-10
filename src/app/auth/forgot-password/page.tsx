"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../AuthPages.module.css";
import { resolveEmail } from "@/lib/email-resolver";
import { normalizeLoginIdentifier } from "@/lib/login-validator";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";

type PageStep = "email" | "otp" | "reset";

export default function ForgotPasswordPage() {
    const { refreshSession } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState<PageStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // OTP states
    const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
    const [resendTimer, setResendTimer] = useState(0);
    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    // Password view state
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Resend countdown
    useEffect(() => {
        if (resendTimer > 0) {
            const interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [resendTimer]);

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
            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resolved }),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: "A 6-digit verification code has been sent to " + resolved });
                setStep("otp");
                setOtpValues(Array(6).fill(""));
                setResendTimer(60);
                setTimeout(() => {
                    otpInputsRef.current[0]?.focus();
                }, 100);
            } else {
                setMessage({ type: "error", text: data.error || "Unable to send verification code." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const otpCode = otpValues.join("");
        if (otpCode.length !== 6) {
            setMessage({ type: "error", text: "Please enter all 6 digits of the verification code." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resolveEmail(email.trim()), otp: otpCode }),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: "Email verified! Choose a new password." });
                setStep("reset");
                setPassword("");
                setConfirmPassword("");
            } else {
                setMessage({ type: "error", text: data.error || "Incorrect verification code." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleResetSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.length < 8) {
            setMessage({ type: "error", text: "Password must be at least 8 characters long." });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: resolveEmail(email.trim()), password }),
            });
            const data = await response.json();

            if (response.ok) {
                if (data.token) {
                    localStorage.setItem("auth_token", data.token);
                }
                await refreshSession();
                setMessage({ type: "success", text: "Password reset and logged in successfully!" });
                
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
            } else {
                setMessage({ type: "error", text: data.error || "Failed to reset password." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (val: string, index: number) => {
        const cleanVal = val.replace(/[^0-9]/g, "");
        if (!cleanVal) return;

        const newOtp = [...otpValues];
        newOtp[index] = cleanVal.slice(-1);
        setOtpValues(newOtp);

        if (index < 5) {
            otpInputsRef.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            if (!otpValues[index] && index > 0) {
                const newOtp = [...otpValues];
                newOtp[index - 1] = "";
                setOtpValues(newOtp);
                otpInputsRef.current[index - 1]?.focus();
            } else {
                const newOtp = [...otpValues];
                newOtp[index] = "";
                setOtpValues(newOtp);
            }
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
        if (text.length === 6) {
            const digits = text.split("");
            setOtpValues(digits);
            otpInputsRef.current[5]?.focus();
        }
    };

    const getPasswordStrength = (pass: string) => {
        let score = 0;
        if (!pass) return { score: 0, label: "", color: "transparent" };
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { score: 25, label: "Weak", color: "#ef4444" };
        if (score === 2) return { score: 50, label: "Fair", color: "#eab308" };
        if (score === 3) return { score: 75, label: "Good", color: "#3b82f6" };
        return { score: 100, label: "Strong", color: "#22c55e" };
    };

    const strength = getPasswordStrength(password);

    return (
        <main className={styles.page}>
            <section className={styles.card}>
                <h1 className={styles.title}>Forgot Password</h1>
                
                {step === "email" && (
                    <>
                        <p className={styles.subtitle}>Enter your email and we will send you a verification code.</p>
                        <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    inputMode="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>
                            <button className={styles.button} disabled={loading}>
                                {loading ? "Sending Code..." : "Send Verification Code"}
                            </button>
                        </form>
                    </>
                )}

                {step === "otp" && (
                    <>
                        <p className={styles.subtitle}>Enter the 6-digit code sent to your email address.</p>
                        <form className={styles.form} onSubmit={handleOtpSubmit}>
                            <div style={{ display: "flex", gap: "8px", justifyContent: "center", margin: "16px 0" }}>
                                {otpValues.map((val, idx) => (
                                    <input
                                        key={idx}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={val}
                                        ref={(el) => { otpInputsRef.current[idx] = el; }}
                                        onChange={(e) => handleOtpChange(e.target.value, idx)}
                                        onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                                        onPaste={handleOtpPaste}
                                        style={{
                                            width: "48px",
                                            height: "48px",
                                            textAlign: "center",
                                            fontSize: "20px",
                                            fontWeight: "700",
                                            border: "1px solid var(--glass-border)",
                                            borderRadius: "8px",
                                            background: "var(--surface-soft)",
                                            color: "var(--foreground)"
                                        }}
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>

                            <div style={{ textAlign: "center", fontSize: "14px", color: "var(--text-muted)", marginBottom: "8px" }}>
                                {resendTimer > 0 ? (
                                    <span>Resend code in <strong>{resendTimer}s</strong></span>
                                ) : (
                                    <button
                                        type="button"
                                        style={{
                                            background: "none",
                                            border: "none",
                                            color: "var(--primary)",
                                            cursor: "pointer",
                                            fontWeight: "600",
                                            padding: "0"
                                        }}
                                        onClick={handleEmailSubmit}
                                        disabled={loading}
                                    >
                                        Resend Code
                                    </button>
                                )}
                            </div>

                            <button className={styles.button} disabled={loading}>
                                {loading ? "Verifying..." : "Verify Code"}
                            </button>
                        </form>
                    </>
                )}

                {step === "reset" && (
                    <>
                        <p className={styles.subtitle}>Enter your new password below.</p>
                        <form className={styles.form} onSubmit={handleResetSubmit}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ position: "relative" }}>
                                    <input
                                        className={styles.input}
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        style={{ width: "100%" }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        style={{
                                            position: "absolute",
                                            right: "12px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--text-muted)"
                                        }}
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>

                                {password && (
                                    <div style={{ display: "grid", gap: "6px" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                            Password Strength: <span style={{ color: strength.color, fontWeight: "600" }}>{strength.label}</span>
                                        </div>
                                        <div style={{ height: "4px", background: "var(--glass-border)", borderRadius: "2px", overflow: "hidden" }}>
                                            <div
                                                style={{
                                                    height: "100%",
                                                    width: `${strength.score}%`,
                                                    backgroundColor: strength.color,
                                                    transition: "width 0.2s"
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ position: "relative" }}>
                                    <input
                                        className={styles.input}
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm New Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        style={{ width: "100%" }}
                                        required
                                    />
                                    <button
                                        type="button"
                                        style={{
                                            position: "absolute",
                                            right: "12px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "var(--text-muted)"
                                        }}
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button className={styles.button} disabled={loading}>
                                {loading ? "Resetting..." : "Reset Password"}
                            </button>
                        </form>
                    </>
                )}

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
