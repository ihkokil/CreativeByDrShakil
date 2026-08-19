"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "@/components/Auth/Auth.module.css";
import pageStyles from "../auth/AuthPages.module.css";
import { normalizeLoginIdentifier } from "@/lib/login-validator";
import { useAuth } from "@/context/AuthContext";
import { Mail, Lock, User, Phone, FileText, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";

type PageStep = "email" | "otp" | "register";

function RegisterContent() {
    const { refreshSession } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [step, setStep] = useState<PageStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Profile fields
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bmdc, setBmdc] = useState("");

    // OTP states
    const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
    const [resendTimer, setResendTimer] = useState(0);
    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Sync query parameters
    useEffect(() => {
        const emailParam = searchParams.get("email");
        const otpSentParam = searchParams.get("otpSent");

        if (emailParam) {
            setEmail(emailParam);
            if (otpSentParam === "true") {
                setStep("otp");
                setResendTimer(60);
                setMessage({
                    type: "success",
                    text: `We sent a 6-digit verification code to ${emailParam}.`,
                });
                setTimeout(() => {
                    otpInputsRef.current[0]?.focus();
                }, 100);
            }
        }
    }, [searchParams]);

    // Resend timer
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
        setEmail(resolved);

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
                setMessage({
                    type: "success",
                    text: "An account with this email already exists. Redirecting to login...",
                });
                setTimeout(() => {
                    router.push(`/login?email=${encodeURIComponent(resolved)}`);
                }, 1500);
            } else {
                const otpResponse = await fetch("/api/auth/send-otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: resolved }),
                });
                const otpData = await otpResponse.json();

                if (!otpResponse.ok) {
                    setMessage({ type: "error", text: otpData.error || "Failed to send verification code." });
                } else {
                    setMessage({ type: "success", text: "We sent a 6-digit verification code to " + email });
                    setStep("otp");
                    setOtpValues(Array(6).fill(""));
                    setResendTimer(60);
                    setTimeout(() => {
                        otpInputsRef.current[0]?.focus();
                    }, 100);
                }
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: "error", text: data.error || "Failed to send verification code." });
            } else {
                setMessage({ type: "success", text: "A new verification code has been sent to " + email });
                setOtpValues(Array(6).fill(""));
                setResendTimer(60);
                setTimeout(() => {
                    otpInputsRef.current[0]?.focus();
                }, 100);
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
                body: JSON.stringify({ email: email.trim(), otp: otpCode }),
            });
            const data = await response.json();

            if (response.ok) {
                setMessage({ type: "success", text: "Email verified! Please complete registration." });
                setStep("register");
            } else {
                setMessage({ type: "error", text: data.error || "Incorrect verification code." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const bdPhoneRegex = /^01[3-9]\d{8}$/;
        if (!bdPhoneRegex.test(phone)) {
            setMessage({ type: "error", text: "Please enter a valid BD phone number (e.g., 017XXXXXXXX)." });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ type: "error", text: "Passwords do not match." });
            return;
        }
        if (password.length < 8) {
            setMessage({ type: "error", text: "Password must be at least 8 characters long." });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    fullName,
                    phone,
                    bmdc,
                    otpVerified: true,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: "error", text: data.error || "Registration failed." });
            } else {
                if (data.token) {
                    localStorage.setItem("auth_token", data.token);
                }
                await refreshSession();
                setMessage({ type: "success", text: "Account created and logged in!" });

                const userRole = data.user?.role || "student";
                setTimeout(() => {
                    if (userRole === "admin") {
                        router.push("/admin/dashboard");
                    } else if (userRole === "teacher") {
                        router.push("/teacher/dashboard");
                    } else {
                        router.push("/dashboard/courses");
                    }
                }, 1000);
            }
        } catch (err) {
            setMessage({ type: "error", text: "Connection error. Please try again." });
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        setMessage(null);
        if (step === "otp") {
            setStep("email");
        } else if (step === "register") {
            setStep("otp");
            setOtpValues(Array(6).fill(""));
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

    const getStepsInfo = () => {
        if (step === "email") return { current: 0, total: 3 };
        if (step === "otp") return { current: 1, total: 3 };
        if (step === "register") return { current: 2, total: 3 };
        return null;
    };
    const stepsInfo = getStepsInfo();

    return (
        <main className={pageStyles.page}>
            <section className={`${styles.modal} glass`} style={{ position: "relative" }}>
                {step !== "email" && (
                    <button
                        className={styles.backBtn}
                        onClick={handleBack}
                        type="button"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                <div className={styles.header}>
                    {stepsInfo && (
                        <div className={styles.progressTracker}>
                            {Array.from({ length: stepsInfo.total }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`${styles.progressDot} ${
                                        idx <= stepsInfo.current ? styles.activeDot : ""
                                    }`}
                                />
                            ))}
                        </div>
                    )}

                    <h2 className={styles.title}>
                        {step === "email" && "Welcome "}
                        {step === "otp" && "Verify "}
                        {step === "register" && "Complete "}
                        <span className="gradient-text">
                            {step === "email" && "Guest!"}
                            {step === "otp" && "Code"}
                            {step === "register" && "Profile"}
                        </span>
                    </h2>
                    <p className={styles.subtitle}>
                        {step === "email" && "Enter your email to verify and start registration."}
                        {step === "otp" && `We sent a 6-digit verification code to ${email}`}
                        {step === "register" && `Set up your credentials to create your account.`}
                    </p>
                </div>

                {step === "email" && (
                    <form className={styles.form} onSubmit={handleEmailSubmit} noValidate>
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
                        {message ? <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div> : null}
                        <button className={styles.submitBtn} disabled={loading}>
                            {loading ? "Checking email..." : "Continue"}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>
                )}

                {step === "otp" && (
                    <form className={styles.form} onSubmit={handleOtpSubmit}>
                        <div className={styles.emailDisplay}>
                            <Mail size={16} />
                            <span>{email}</span>
                        </div>

                        <div className={styles.otpContainer}>
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
                                    className={styles.otpInput}
                                    autoFocus={idx === 0}
                                />
                            ))}
                        </div>

                        <div className={styles.resendContainer}>
                            {resendTimer > 0 ? (
                                <span>Resend code in <strong>{resendTimer}s</strong></span>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.resendBtn}
                                    onClick={handleResendOtp}
                                    disabled={loading}
                                >
                                    Resend Code
                                </button>
                            )}
                        </div>

                        {message ? <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div> : null}

                        <button className={styles.submitBtn} disabled={loading}>
                            {loading ? "Verifying..." : "Verify Code"}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>
                )}

                {step === "register" && (
                    <form className={styles.form} onSubmit={handleRegisterSubmit}>
                        <div className={styles.emailDisplay}>
                            <Mail size={16} />
                            <span>{email}</span>
                        </div>

                        <div className={styles.inputGroup}>
                            <User className={styles.inputIcon} size={18} />
                            <input
                                type="text"
                                placeholder="Full Name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.row}>
                            <div className={`${styles.inputGroup} ${styles.halfWidth}`}>
                                <Phone className={styles.inputIcon} size={18} />
                                <input
                                    type="tel"
                                    placeholder="Phone (e.g. 017XXXXXXXX)"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={`${styles.inputGroup} ${styles.halfWidth}`}>
                                <FileText className={styles.inputIcon} size={18} />
                                <input
                                    type="text"
                                    placeholder="BM&DC Number"
                                    value={bmdc}
                                    onChange={(e) => setBmdc(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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

                        {password && (
                            <div className={styles.strengthContainer}>
                                <div className={styles.strengthMeter}>
                                    <div
                                        className={styles.strengthFill}
                                        style={{ width: `${strength.score}%`, backgroundColor: strength.color }}
                                    />
                                </div>
                                <div className={styles.strengthText} style={{ color: strength.color }}>
                                    {strength.label} Password
                                </div>
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <Lock className={styles.inputIcon} size={18} />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Retype Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                className={styles.eyeBtn}
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            >
                                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>

                        {message ? <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div> : null}

                        <button className={styles.submitBtn} disabled={loading}>
                            {loading ? "Creating account..." : "Complete Setup"}
                            {!loading && <ArrowRight size={18} />}
                        </button>
                    </form>
                )}

                <p className={styles.toggleText}>
                    Already have an account?
                    <Link href="/login" style={{ color: "var(--primary)", fontWeight: 700, marginLeft: "5px" }}>
                        Sign in
                    </Link>
                </p>
            </section>
        </main>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <main className={pageStyles.page}>
                <section className={`${styles.modal} glass`} style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px" }}>
                    <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading...</p>
                </section>
            </main>
        }>
            <RegisterContent />
        </Suspense>
    );
}
