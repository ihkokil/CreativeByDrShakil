"use client";

import { useState } from "react";
import styles from "./AdminModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Send, Building2, Briefcase, GraduationCap, ImagePlus } from "lucide-react";
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
    const [designation, setDesignation] = useState("");
    const [institution, setInstitution] = useState("");
    const [degrees, setDegrees] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!session) {
                setMessage({ type: 'error', text: 'You must be logged in.' });
                setLoading(false);
                return;
            }

            const response = await fetch('/api/admin/invite-teacher', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ fullName, email, designation, institution, degrees, profileImage }),
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to invite teacher.' });
            } else {
                setMessage({ type: 'success', text: data.message || 'Teacher invited successfully!' });
                setFullName("");
                setEmail("");
                setDesignation("");
                setInstitution("");
                setDegrees("");
                setProfileImage("");
                // Refresh the teacher list after a short delay
                setTimeout(() => {
                    onSuccess();
                }, 2000);
            }
        } catch (err: any) {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessage(null);
        setFullName("");
        setEmail("");
        setDesignation("");
        setInstitution("");
        setDegrees("");
        setProfileImage("");
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
                            <div className={styles.imageUploadWrapper}>
                                <label className={styles.imageLabel}>
                                    {profileImage ? (
                                        <img src={profileImage} alt="Profile preview" className={styles.imagePreview} />
                                    ) : (
                                        <div className={styles.imagePlaceholder}>
                                            <ImagePlus size={24} style={{ marginBottom: "5px" }} />
                                            <div>Upload Photo</div>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                                </label>
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
                                <Briefcase className={styles.inputIcon} size={18} />
                                <input
                                    type="text"
                                    placeholder="Designation (e.g. Assistant Professor)"
                                    value={designation}
                                    onChange={(e) => setDesignation(e.target.value)}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <Building2 className={styles.inputIcon} size={18} />
                                <input
                                    type="text"
                                    placeholder="Institution / Workplace"
                                    value={institution}
                                    onChange={(e) => setInstitution(e.target.value)}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <GraduationCap className={styles.inputIcon} size={18} />
                                <input
                                    type="text"
                                    placeholder="Degrees (e.g. MBBS, FCPS)"
                                    value={degrees}
                                    onChange={(e) => setDegrees(e.target.value)}
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
