"use client";

import { useState } from "react";
import styles from "./AdminModal.module.css";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

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
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [reassignToId, setReassignToId] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const availableTeachers = allTeachers.filter(t => t.id !== teacherTarget?.id);

    const handleDelete = async () => {
        if (!reassignToId && availableTeachers.length > 0) {
            setMessage({ type: 'error', text: 'You must select a teacher to reassign courses to.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            if (!session || !teacherTarget) return;

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
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Network error. Please try again.' });
        }

        setLoading(false);
    };

    if (!teacherTarget) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles.overlay} onClick={onClose}>
                    <motion.div
                        className={`${styles.modal} glass`}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button className={styles.closeBtn} onClick={onClose}>
                            <X size={20} />
                        </button>

                        <div className={styles.header}>
                            <AlertTriangle size={32} color="var(--danger)" style={{ marginBottom: "1rem" }} />
                            <h2 className={styles.title}>
                                <span style={{color: "var(--danger)"}}>Delete Teacher</span>
                            </h2>
                            <p className={styles.subtitle}>
                                You are about to permanently delete <strong>{teacherTarget.full_name}</strong>. This action cannot be undone.
                            </p>
                        </div>

                        {availableTeachers.length > 0 ? (
                            <div className={styles.reassignSection} style={{ marginBottom: "1.5rem" }}>
                                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", fontWeight: 600 }}>
                                    Reassign their courses to:
                                </label>
                                <select 
                                    className={styles.selectInput}
                                    value={reassignToId}
                                    onChange={(e) => setReassignToId(e.target.value)}
                                    style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
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
                            <div style={{ marginBottom: "1.5rem", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                                No other teachers available to reassign courses to. Data might be lost.
                            </div>
                        )}

                        {message && (
                            <div className={`${styles.message} ${styles[message.type]}`}>
                                {message.text}
                            </div>
                        )}

                        <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                            <button 
                                className={styles.submitBtn} 
                                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--foreground)" }} 
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button 
                                className={styles.submitBtn} 
                                style={{ background: "var(--danger)", color: "white" }} 
                                onClick={handleDelete} 
                                disabled={loading || (!reassignToId && availableTeachers.length > 0)}
                            >
                                {loading ? "Deleting..." : "Delete Permanently"}
                                {!loading && <Trash2 size={18} />}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
