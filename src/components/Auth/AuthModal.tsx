"use client";

import { useState } from "react";
import styles from "./Auth.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, ArrowRight, Github, Chrome, User, Phone, FileText, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: Props) {
    const { refreshSession } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Registration only fields
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bmdc, setBmdc] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // UI states
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isLogin) {
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
        }

        setLoading(true);
        setMessage(null);
        setPendingVerificationEmail("");

        const response = await fetch(isLogin ? '/api/auth/login' : '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
                isLogin
                    ? { identifier: email, password }
                    : { email, password, fullName, phone, bmdc }
            ),
        });

        const data = await response.json();

        if (!response.ok) {
            setMessage({ type: 'error', text: data.error || 'Authentication failed.' });
            if (data.code === 'email_not_verified' && data.email) {
                setPendingVerificationEmail(data.email);
            }
        } else {
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }
            if (isLogin) {
                await refreshSession();
                setMessage({
                    type: 'success',
                    text: 'Successfully logged in!',
                });
                setTimeout(onClose, 1200);
            } else {
                setMessage({
                    type: 'success',
                    text: data.message || 'Account created. Please verify your email before logging in.',
                });
            }
        }
        setLoading(false);
    };

    const handleResendVerification = async () => {
        if (!pendingVerificationEmail) {
            return;
        }

        setLoading(true);
        const response = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerificationEmail }),
        });

        const data = await response.json();
        if (response.ok) {
            setMessage({ type: 'success', text: data.message || 'Verification email sent.' });
        } else {
            setMessage({ type: 'error', text: data.error || 'Could not resend verification email.' });
        }
        setLoading(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay} onClick={onClose}>
                    <motion.div
                        className={`${styles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X size={20} />
                        </button>

                        <div className={styles.header}>
                            <h2 className={styles.title}>
                                {isLogin ? "Welcome " : "Create "}
                                <span className="gradient-text">Account</span>
                            </h2>
                            <p className={styles.subtitle}>
                                {isLogin ? "Access your courses and progress." : "Start your medical journey today."}
                            </p>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            {!isLogin && (
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
                            )}

                            <div className={styles.inputGroup}>
                                {isLogin && !email.includes('@') && email.length > 0 ? (
                                    <Phone className={styles.inputIcon} size={18} />
                                ) : (
                                    <Mail className={styles.inputIcon} size={18} />
                                )}
                                <input
                                    type={isLogin ? "text" : "email"}
                                    placeholder={isLogin ? "Email or Phone Number" : "Email Address"}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {!isLogin && (
                                <div className={styles.row}>
                                    <div className={`${styles.inputGroup} ${styles.halfWidth}`}>
                                        <Phone className={styles.inputIcon} size={18} />
                                        <input
                                            type="tel"
                                            placeholder="Phone Number"
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
                            )}

                            <div>
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
                                {!isLogin && password && (
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

                                {isLogin && (
                                    <div className={styles.forgotWrap}>
                                        <Link href="/auth/forgot-password" className={styles.forgotLink} onClick={onClose}>
                                            Forgot password?
                                        </Link>
                                    </div>
                                )}
                            </div>

                            {!isLogin && (
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
                            )}

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            {pendingVerificationEmail && (
                                <button type="button" className={styles.secondaryBtn} onClick={handleResendVerification}>
                                    Resend verification email
                                </button>
                            )}

                            <button className={styles.submitBtn} disabled={loading}>
                                {loading ? "Processing..." : (isLogin ? "Login Now" : "Sign Up")}
                                {!loading && <ArrowRight size={18} />}
                            </button>
                        </form>

                        <div className={styles.divider}>
                            <span>Or continue with</span>
                        </div>

                        <div className={styles.socialBar}>
                            <button className={styles.socialBtn}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
                                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                                </svg>
                                <span style={{ marginLeft: "8px" }}>Google</span>
                            </button>
                            <button className={styles.socialBtn}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                                    <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                                <span style={{ marginLeft: "8px" }}>Facebook</span>
                            </button>
                        </div>

                        <p className={styles.toggleText}>
                            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                            <button onClick={() => setIsLogin(!isLogin)}>
                                {isLogin ? "Create one" : "Login here"}
                            </button>
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
