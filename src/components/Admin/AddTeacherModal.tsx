"use client";

import { useState } from "react";
import styles from "./AdminModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddTeacherModal({ isOpen, onClose, onSuccess }: Props) {
    const { session } = useAuth();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
        setMessage(msg);
        setTimeout(() => {
            setMessage(null);
        }, 3000);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!session) {
                showMessage({ type: 'error', text: 'You must be logged in.' });
                setLoading(false);
                return;
            }

            const response = await fetch('/api/admin/invite-teacher', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ fullName, email }),
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage({ type: 'error', text: data.error || 'Failed to invite teacher.' });
            } else {
                showMessage({ type: 'success', text: data.message || 'Teacher invited successfully!' });
                setFullName("");
                setEmail("");
                // Refresh the teacher list after a short delay
                setTimeout(() => {
                    onSuccess();
                }, 2000);
            }
        } catch (err: any) {
            showMessage({ type: 'error', text: 'Network error. Please try again.' });
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessage(null);
        setFullName("");
        setEmail("");
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay} onClick={handleClose}>
                    <motion.div
                        className={`${styles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={handleClose}>
                            <X size={20} />
                        </button>

                        <div className={styles.header}>
                            <h2 className={styles.title}>
                                Add <span className="gradient-text">Teacher</span>
                            </h2>
                            <p className={styles.subtitle}>
                                Enter the teacher&apos;s details. A password setup link will be sent to their email.
                            </p>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
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

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button className={styles.submitBtn} type="submit" disabled={loading}>
                                {loading ? "Sending Invitation..." : "Send Invitation"}
                                {!loading && <Send size={18} />}
                            </button>
                        </form>

                        <p className={styles.note}>
                            The teacher will receive an email with a link to set their password and access the platform.
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
