"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./AdminModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, User, Send, Building2, Briefcase, GraduationCap, ImagePlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/hooks/useModal";

interface Teacher {
    id: string;
    full_name: string;
    email: string;
    designation?: string | null;
    institution?: string | null;
    degrees?: string | null;
    profile_image?: string | null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    teacher: Teacher | null;
}

export default function EditTeacherModal({ isOpen, onClose, onSuccess, teacher }: Props) {
    useModal(isOpen, onClose);
    const { session } = useAuth();
    const [prevTeacherId, setPrevTeacherId] = useState<string | null>(teacher?.id || null);
    const [fullName, setFullName] = useState(teacher?.full_name || "");
    const [email, setEmail] = useState(teacher?.email || "");
    const [designation, setDesignation] = useState(teacher?.designation || "");
    const [institution, setInstitution] = useState(teacher?.institution || "");
    const [degrees, setDegrees] = useState(teacher?.degrees || "");
    const [profileImage, setProfileImage] = useState(teacher?.profile_image || "");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    if (teacher && teacher.id !== prevTeacherId) {
        setPrevTeacherId(teacher.id);
        setFullName(teacher.full_name || "");
        setEmail(teacher.email || "");
        setDesignation(teacher.designation || "");
        setInstitution(teacher.institution || "");
        setDegrees(teacher.degrees || "");
        setProfileImage(teacher.profile_image || "");
    }

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
            if (!session || !teacher) {
                setMessage({ type: 'error', text: 'You must be logged in and a teacher selected.' });
                setLoading(false);
                return;
            }

            const response = await fetch(`/api/admin/teachers/${teacher.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ fullName, email, designation, institution, degrees, profileImage }),
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to update teacher.' });
            } else {
                setMessage({ type: 'success', text: 'Teacher updated successfully!' });
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        }

        setLoading(false);
    };

    const handleClose = () => {
        setMessage(null);
        onClose();
    };

    if (!teacher) return null;

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
                                Edit <span className="gradient-text">Teacher</span>
                            </h2>
                            <p className={styles.subtitle}>
                                Update the details for {teacher.full_name}.
                            </p>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.imageUploadWrapper}>
                                <label className={styles.imageLabel}>
                                    {profileImage ? (
                                        <Image src={profileImage} alt="Profile preview" width={100} height={100} unoptimized className={styles.imagePreview} />
                                    ) : (
                                        <div className={styles.imagePlaceholder}>
                                            <ImagePlus size={24} style={{ marginBottom: "5px" }} />
                                            <div>Upload Photo</div>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                                </label>
                            </div>

                            <div className={styles.formGrid2Col}>
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

                                <div className={`${styles.inputGroup} ${styles.fullWidthCol}`}>
                                    <GraduationCap className={styles.inputIcon} size={18} />
                                    <input
                                        type="text"
                                        placeholder="Degrees (e.g. MBBS, FCPS, MD)"
                                        value={degrees}
                                        onChange={(e) => setDegrees(e.target.value)}
                                    />
                                </div>
                            </div>

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.text}
                                </div>
                            )}

                            <button className={styles.submitBtn} type="submit" disabled={loading}>
                                {loading ? "Updating..." : "Update Teacher"}
                                {!loading && <Send size={18} />}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
