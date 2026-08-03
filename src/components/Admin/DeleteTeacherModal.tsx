"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/hooks/useModal";

interface Teacher {
    id: string;
    full_name: string;
    email: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    teacherTarget: Teacher | null;
    allTeachers: Teacher[];
}

export default function DeleteTeacherModal({ isOpen, onClose, onSuccess, teacherTarget, allTeachers }: Props) {
    useModal(isOpen, onClose);
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reassignToId, setReassignToId] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const availableTeachers = allTeachers.filter(t => t.id !== teacherTarget?.id);

    const clearCloseTimer = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        clearCloseTimer();
        setLoading(false);
        setMessage(null);
        setReassignToId("");
    }, [isOpen, teacherTarget?.id]);

    useEffect(() => {
        return () => {
            clearCloseTimer();
        };
    }, []);

    const handleDelete = async () => {
        if (!reassignToId && availableTeachers.length > 0) {
            setMessage({ type: 'error', text: 'You must select a teacher to reassign courses to.' });
            return;
        }

        if (!session || !teacherTarget) {
            setMessage({ type: 'error', text: 'You must be logged in and select a teacher.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const response = await fetch(`/api/admin/teachers/${teacherTarget.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ reassignToId }),
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: 'error', text: data.error || 'Failed to delete teacher.' });
            } else {
                setMessage({ type: 'success', text: data.message || 'Teacher deleted successfully.' });
                clearCloseTimer();
                closeTimerRef.current = setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            }
        } catch {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        clearCloseTimer();
        setLoading(false);
        setMessage(null);
        setReassignToId("");
        onClose();
    };

    if (!teacherTarget) return null;

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
                            <div className={styles.dangerIconWrap}>
                                <AlertTriangle size={22} />
                            </div>
                            <h2 className={styles.title}>
                                <span className={styles.dangerTitle}>Delete Teacher</span>
                            </h2>
                            <p className={styles.subtitle}>
                                You are about to permanently delete <strong>{teacherTarget.full_name}</strong>. This action cannot be undone.
                            </p>
                        </div>

                        {availableTeachers.length > 0 ? (
                            <div className={styles.reassignSection}>
                                <p className={styles.warningCard}>
                                    Existing courses must be reassigned before deletion.
                                </p>
                                <label className={styles.fieldLabel}>
                                    Reassign their courses to:
                                </label>
                                <select 
                                    className={styles.selectInput}
                                    value={reassignToId}
                                    onChange={(e) => setReassignToId(e.target.value)}
                                >
                                    <option value="" disabled>Select a teacher...</option>
                                    {availableTeachers.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.full_name} ({t.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div className={styles.warningCard}>
                                No other teachers available to reassign courses to. Data might be lost.
                            </div>
                        )}

                        {message && (
                            <div className={`${styles.message} ${styles[message.type]}`}>
                                {message.text}
                            </div>
                        )}

                        <div className={styles.actionsRow}>
                            <button 
                                className={`${styles.submitBtn} ${styles.secondaryBtn}`}
                                onClick={handleClose}
                            >
                                Cancel
                            </button>
                            <button 
                                className={`${styles.submitBtn} ${styles.dangerBtn}`}
                                onClick={handleDelete} 
                                disabled={loading || (!reassignToId && availableTeachers.length > 0)}
                            >
                                {loading ? "Deleting..." : "Delete"}
                                {!loading && <Trash2 size={18} />}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
