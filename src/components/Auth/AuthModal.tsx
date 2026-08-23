"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./Auth.module.css";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { User, LogOut, Layout, BookOpen, Mail, Menu, X, Home, Lock, ArrowRight, ArrowLeft, Phone, FileText, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useModalLock } from "@/hooks/useModalLock";
import { normalizeLoginIdentifier } from "@/lib/login-validator";
import { renderTextWithEmailLinks } from "@/utils/renderWithLinks";


interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (role: string) => void;
    defaultMode?: "login" | "register" | "forgot";
}

type AuthStep = "email" | "password" | "otp" | "register" | "forgot" | "forgot-otp" | "forgot-reset";

export default function AuthModal({ isOpen, onClose, onSuccess, defaultMode = "login" }: Props) {
    useModalLock(isOpen, onClose);
    const { refreshSession, showBannedModal } = useAuth();
    const [step, setStep] = useState<AuthStep>("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Registration only fields
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bmdc, setBmdc] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // OTP verification fields
    const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
    const [resendTimer, setResendTimer] = useState(0);
    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Sync step with defaultMode when modal opens
    useEffect(() => {
        if (isOpen) {
            if (defaultMode === "forgot") {
                setStep("forgot");
            } else {
                setStep("email");
            }
            setMessage(null);
            setEmail("");
            setPassword("");
            setFullName("");
            setPhone("");
            setBmdc("");
            setConfirmPassword("");
            setOtpValues(Array(6).fill(""));
            setResendTimer(0);

            // Read error query parameters on load
            if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                const err = params.get("error");
                const customMsg = params.get("message");
                if (err === "Banned" || err === "user_banned") {
                    showBannedModal(customMsg || undefined);
                    onClose();
                } else if (err === "DeviceAlreadyLoggedIn") {
                    setMessage({
                        type: 'error',
                        text: 'You are already logged in on another browser on this device. Please log out from the previous session or contact support@creativebydrshakil.com for assistance.'
                    });
                } else if (err === "device_category_locked") {
                    setMessage({
                        type: 'error',
                        text: customMsg || 'This account is already linked to a different device. You can only access your account from your registered device, or contact support@creativebydrshakil.com for assistance.'
                    });
                } else if (err === "OAuthDenied") {
                    setMessage({
                        type: 'error',
                        text: 'Google OAuth login was denied.'
                    });
                } else if (err === "OAuthInitFailed" || err === "TokenExchangeFailed" || err === "UserInfoFailed" || err === "OAuthUnexpected") {
                    setMessage({
                        type: 'error',
                        text: 'An error occurred during Google Sign-In. Please try again.'
                    });
                }
            }
        }
    }, [defaultMode, isOpen]);

    // Resend countdown timer
    useEffect(() => {
        if (resendTimer > 0) {
            const interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [resendTimer]);

    const getPasswordStrength = (pass: string) => {
        let score = 0;
        if (!pass) return { score: 0, label: '', color: 'transparent' };
        if (pass.length >= 8) score++;
        if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
        if (/[0-9]/.test(pass)) score++;
        if (/[^A-Za-z0-9]/.test(pass)) score++;

        if (score <= 1) return { score: 25, label: 'Weak', color: '#ef4444' };
        if (score === 2) return { score: 50, label: 'Fair', color: '#eab308' };
        if (score === 3) return { score: 75, label: 'Good', color: '#3b82f6' };
        return { score: 100, label: 'Strong', color: '#22c55e' };
    };

    const strength = getPasswordStrength(password);

    // Form handlers
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = normalizeLoginIdentifier(email);
        if (!result.valid) {
            setMessage({ type: 'error', text: result.reason });
            return;
        }
        const resolved = result.email;
        setEmail(resolved);

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resolved }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to check email.' });
                setLoading(false);
                return;
            }

            if (data.exists) {
                setStep("password");
            } else {
                // Send OTP email
                const sendResponse = await fetch('/api/auth/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: resolved }),
                });
                const sendData = await sendResponse.json();

                if (!sendResponse.ok) {
                    setMessage({ type: 'error', text: sendData.error || 'Failed to send verification code.' });
                } else {
                    setMessage({ type: 'success', text: 'We sent a 6-digit verification code to ' + email });
                    setStep("otp");
                    setOtpValues(Array(6).fill(""));
                    setResendTimer(60);
                    // Focus first OTP field after transition
                    setTimeout(() => {
                        otpInputsRef.current[0]?.focus();
                    }, 100);
                }
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };


    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            let hash = '';
            let os = '';
            let category: "mobile" | "tablet" | "desktop" | "" = '';
            let label = '';
            try {
                const { getDeviceHash, detectOS, getDeviceCategory, getDeviceLabel } = await import('@/lib/client-fingerprint');
                hash = await getDeviceHash();
                const ua = navigator.userAgent;
                os = detectOS(ua);
                category = getDeviceCategory(ua, navigator.maxTouchPoints || 0, window.screen?.width || 1024, window.screen?.height || 768);
                label = getDeviceLabel(ua, category);
            } catch {}

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: email.trim(),
                    password,
                    deviceHash: hash,
                    deviceType: category,
                    deviceLabel: label,
                    osInfo: os,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                if (data?.code === 'user_banned') {
                    showBannedModal(data.error);
                    onClose();
                    return;
                }
                setMessage({ type: 'error', text: data.error || 'Invalid credentials.' });
            } else {
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }
                await refreshSession();
                setMessage({ type: 'success', text: 'Successfully logged in!' });
                
                if (onSuccess) onSuccess(data.user?.role || 'student');
                setTimeout(onClose, 1000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };


    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpCode = otpValues.join("");
        if (otpCode.length !== 6) {
            setMessage({ type: 'error', text: 'Please enter all 6 digits of the verification code.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otpCode }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Verification failed.' });
            } else {
                setMessage({ type: 'success', text: 'Email verified! Please complete registration.' });
                setStep("register");
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };


    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to send verification code.' });
            } else {
                setMessage({ type: 'success', text: 'A new verification code has been sent to ' + email });
                setOtpValues(Array(6).fill(""));
                setResendTimer(60);
                setTimeout(() => {
                    otpInputsRef.current[0]?.focus();
                }, 100);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const bdPhoneRegex = /^01[3-9]\d{8}$/;
        if (!bdPhoneRegex.test(phone)) {
            setMessage({ type: 'error', text: 'Please enter a valid BD phone number (e.g., 017XXXXXXXX).' });
            return;
        }
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        if (strength.score < 50) {
            setMessage({ type: 'error', text: 'Please use a stronger password.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                setMessage({ type: 'error', text: data.error || 'Registration failed.' });
            } else {
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }
                await refreshSession();
                setMessage({ type: 'success', text: 'Account created and logged in!' });

                if (onSuccess) onSuccess(data.user?.role || 'student');
                setTimeout(onClose, 1000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleForgotSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const result = normalizeLoginIdentifier(email);
        if (!result.valid) {
            setMessage({ type: 'error', text: result.reason });
            return;
        }
        const resolved = result.email;
        setEmail(resolved);

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resolved }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to send verification code.' });
            } else {
                setMessage({ type: 'success', text: 'A 6-digit verification code has been sent to ' + email });
                setStep("forgot-otp");
                setOtpValues(Array(6).fill(""));
                setResendTimer(60);
                setTimeout(() => {
                    otpInputsRef.current[0]?.focus();
                }, 100);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleForgotOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpCode = otpValues.join("");
        if (otpCode.length !== 6) {
            setMessage({ type: 'error', text: 'Please enter all 6 digits of the verification code.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otpCode }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Verification failed.' });
            } else {
                setMessage({ type: 'success', text: 'Email verified! Please enter your new password.' });
                setStep("forgot-reset");
                setPassword("");
                setConfirmPassword("");
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleForgotResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        if (strength.score < 50) {
            setMessage({ type: 'error', text: 'Please use a stronger password.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to reset password.' });
            } else {
                if (data.token) {
                    localStorage.setItem('auth_token', data.token);
                }
                await refreshSession();
                setMessage({ type: 'success', text: 'Password reset and logged in!' });

                if (onSuccess) onSuccess(data.user?.role || 'student');
                setTimeout(onClose, 1000);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Connection error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };


    const handleBack = () => {
        setMessage(null);
        if (step === "password" || step === "otp") {
            setStep("email");
        } else if (step === "register") {
            setStep("otp");
            setOtpValues(Array(6).fill(""));
        } else if (step === "forgot" || step === "forgot-otp") {
            setStep("email");
        } else if (step === "forgot-reset") {
            setStep("forgot-otp");
            setOtpValues(Array(6).fill(""));
        }
    };

    // OTP inputs helpers
    const handleOtpChange = (val: string, index: number) => {
        const cleanVal = val.replace(/[^0-9]/g, "");
        if (!cleanVal) return;

        const newOtp = [...otpValues];
        newOtp[index] = cleanVal.slice(-1);
        setOtpValues(newOtp);

        // Advance focus
        if (index < 5) {
            otpInputsRef.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            const newOtp = [...otpValues];
            if (newOtp[index] !== "") {
                newOtp[index] = "";
                setOtpValues(newOtp);
            } else if (index > 0) {
                newOtp[index - 1] = "";
                setOtpValues(newOtp);
                otpInputsRef.current[index - 1]?.focus();
            }
        }
    };

    const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
        if (pastedData.length === 6) {
            const newOtp = pastedData.split("");
            setOtpValues(newOtp);
            otpInputsRef.current[5]?.focus();
        }
    };

    // Step indicators data
    const getStepsInfo = () => {
        if (step === "forgot") return null;
        if (step === "password") return { current: 1, total: 2 };
        if (step === "otp") return { current: 1, total: 3 };
        if (step === "register") return { current: 2, total: 3 };
        return { current: 0, total: 3 };
    };
    const stepsInfo = getStepsInfo();

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay}>
                    <motion.div
                        className={`${styles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
                            <X size={20} />
                        </button>

                        {step !== "email" && (
                            <button className={styles.backBtn} onClick={handleBack} type="button" aria-label="Go back">
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
                                {step === "forgot" && "Reset "}
                                {step === "email" && "Welcome "}
                                {step === "password" && "Enter "}
                                {step === "otp" && "Verify "}
                                {step === "register" && "Complete "}
                                <span className="gradient-text">
                                    {step === "forgot" && "Password"}
                                    {step === "email" && "Guest!"}
                                    {step === "password" && "Password"}
                                    {step === "otp" && "Code"}
                                    {step === "register" && "Profile"}
                                </span>
                            </h2>
                            <p className={styles.subtitle}>
                                {step === "forgot" && "Enter your email to receive a password reset link."}
                                {step === "email" && "Enter your email to sign in or get started."}
                                {step === "password" && "Access your courses and progress."}
                                {step === "otp" && "We sent a 6-digit verification code to your email."}
                                {step === "register" && "Set up your credentials to create your account."}
                            </p>
                        </div>

                        {/* Step 1 & 2a: Combined Login Form */}
                        {(step === "email" || step === "password") && (
                            <>
                                <form 
                                    className={styles.form} 
                                    onSubmit={step === "email" ? handleEmailSubmit : handlePasswordSubmit} 
                                    noValidate
                                >
                                    {/* Email Input Group - always in DOM, toggle visibility */}
                                    <div style={{ display: step === "email" ? "block" : "none", width: "100%" }}>
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
                                    </div>

                                    {/* Password Input Group - always in DOM, toggle visibility */}
                                    <div style={{ display: step === "password" ? "block" : "none", width: "100%" }}>
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
                                                required={step === "password"}
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
                                            <button type="button" className={styles.forgotLink} onClick={() => handleForgotSubmit()}>
                                                Forgot password?
                                            </button>
                                        </div>
                                    </div>

                                    {message && (
                                        <div className={`${styles.message} ${styles[message.type]}`}>
                                            {renderTextWithEmailLinks(message.text)}
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
                                                onClick={() => { window.location.href = '/api/auth/nextauth'; }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '10px' }}>
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                                </svg>
                                                Continue with Google
                                            </button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* Step 2b: OTP Verification (New User) */}
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

                                {message && (
                                    <div className={`${styles.message} ${styles[message.type]}`}>
                                        {renderTextWithEmailLinks(message.text)}
                                    </div>
                                )}
                                <button className={styles.submitBtn} disabled={loading}>
                                    {loading ? "Verifying..." : "Verify Code"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        )}

                        {/* Step 3: Registration Profile (New User Verified) */}
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
                                            placeholder="Phone (e.g., 017XXXXXXXX)"
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

                                {message && (
                                    <div className={`${styles.message} ${styles[message.type]}`}>
                                        {renderTextWithEmailLinks(message.text)}
                                    </div>
                                )}
                                <button className={styles.submitBtn} disabled={loading}>
                                    {loading ? "Creating account..." : "Complete Setup"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        )}

                        {/* Step: Forgot Password */}
                        {step === "forgot" && (
                            <form className={styles.form} onSubmit={(e) => handleForgotSubmit(e)} noValidate>
                                <div className={styles.inputGroup}>
                                    <Mail className={styles.inputIcon} size={18} />
                                    <input
                                        type="text"
                                        inputMode="email"
                                        placeholder="Email Address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                {message && (
                                    <div className={`${styles.message} ${styles[message.type]}`}>
                                        {renderTextWithEmailLinks(message.text)}
                                    </div>
                                )}
                                <button className={styles.submitBtn} disabled={loading}>
                                    {loading ? "Processing..." : "Send Code"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        )}

                        {/* Step: Forgot Password OTP */}
                        {step === "forgot-otp" && (
                            <form className={styles.form} onSubmit={handleForgotOtpSubmit}>
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
                                            onClick={() => handleForgotSubmit()}
                                            disabled={loading}
                                        >
                                            Resend Code
                                        </button>
                                    )}
                                </div>

                                {message && (
                                    <div className={`${styles.message} ${styles[message.type]}`}>
                                        {renderTextWithEmailLinks(message.text)}
                                    </div>
                                )}
                                <button className={styles.submitBtn} disabled={loading}>
                                    {loading ? "Verifying..." : "Verify Code"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        )}

                        {/* Step: Forgot Password Reset */}
                        {step === "forgot-reset" && (
                            <form className={styles.form} onSubmit={handleForgotResetSubmit}>
                                <div className={styles.emailDisplay}>
                                    <Mail size={16} />
                                    <span>{email}</span>
                                </div>

                                <div className={styles.inputGroup}>
                                    <Lock className={styles.inputIcon} size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="New Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        name="password"
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

                                {message && (
                                    <div className={`${styles.message} ${styles[message.type]}`}>
                                        {renderTextWithEmailLinks(message.text)}
                                    </div>
                                )}
                                <button className={styles.submitBtn} disabled={loading}>
                                    {loading ? "Resetting & Logging in..." : "Reset Password"}
                                    {!loading && <ArrowRight size={18} />}
                                </button>
                            </form>
                        )}

                        <p className={styles.toggleText}>
                            {step === "forgot" ? (
                                <>
                                    Remembered your password?{" "}
                                    <button type="button" onClick={() => setStep("email")}>
                                        Back to sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    By continuing, you agree to our <Link href="/terms" onClick={onClose} style={{textDecoration: 'underline'}}>Terms</Link> and <Link href="/privacy" onClick={onClose} style={{textDecoration: 'underline'}}>Privacy Policy</Link>.
                                </>
                            )}
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
