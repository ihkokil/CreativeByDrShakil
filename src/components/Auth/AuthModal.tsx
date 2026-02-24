"use client";

import { useState } from "react";
import styles from "./Auth.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, ArrowRight, Github, Chrome } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: Props) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { error } = isLogin
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({ email, password });

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({
                type: 'success',
                text: isLogin ? 'Successfully logged in!' : 'Check your email for the confirmation link.'
            });
            if (isLogin) setTimeout(onClose, 1500);
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
                            <div className={styles.inputGroup}>
                                <Mail className={styles.inputIcon} size={18} />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <Lock className={styles.inputIcon} size={18} />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
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
                                <Chrome size={20} />
                            </button>
                            <button className={styles.socialBtn}>
                                <Github size={20} />
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
