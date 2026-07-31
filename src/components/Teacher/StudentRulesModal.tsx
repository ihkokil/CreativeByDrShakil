"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import Loader from "@/components/UI/Loader";
import { useAuth } from "@/context/AuthContext";
import styles from "./StudentRulesModal.module.css";
import { motion } from "framer-motion";
import { formatDateInputGMT6 } from "@/lib/date-format";
import { useModal } from "@/hooks/useModal";

interface StudentRulesModalProps {
    courseId: string;
    userId?: string;
    userIds?: string[];
    studentName: string;
    onClose: () => void;
    onSuccess: () => void;
    onOpenAdvanced?: () => void;
}

const DAYS = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
];

export default function StudentRulesModal({ courseId, userId, userIds, studentName, onClose, onSuccess, onOpenAdvanced }: StudentRulesModalProps) {
    const [action, setAction] = useState<"start_from_today" | "custom_date" | "week_days" | "custom_interval" | "unlock_all" | "change_batch">("start_from_today");
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [intervalDays, setIntervalDays] = useState<number>(3);
    const [startDate, setStartDate] = useState<string>(() => formatDateInputGMT6(new Date()));
    const [selectedBatchId, setSelectedBatchId] = useState<string>("");
    const [batches, setBatches] = useState<{id: string, name: string, startDate: string}[]>([]);

    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const res = await fetch(`/api/teacher/batches/${courseId}`);
                if (res.ok) {
                    const data = await res.json();
                    setBatches(data.batches || []);
                }
            } catch (err) {
                console.error("Failed to fetch batches", err);
            }
        };
        fetchBatches();
    }, [courseId]);

    useModal(true, onClose);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSave = async () => {
        if (action === "week_days" && daysOfWeek.length === 0) {
            setError("Please select at least one day of the week.");
            return;
        }
        if (action === "custom_interval" && (intervalDays < 1 || isNaN(intervalDays))) {
            setError("Please enter a valid interval greater than 0.");
            return;
        }
        if (action === "custom_date") {
            if (!startDate) {
                setError("Please enter a start date.");
                return;
            }
        }

        try {
            setLoading(true);
            setError("");
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/teacher/students/batch-override", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    courseId,
                    userId,
                    userIds,
                    action,
                    daysOfWeek,
                    intervalDays,
                    batchId: action === "change_batch" ? selectedBatchId || null : undefined,
                    startDate: action === "custom_date" ? startDate : undefined
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to save student rules.");
            }

            onSuccess();
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const toggleDay = (val: number) => {
        setDaysOfWeek(prev =>
            prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
        );
    };

    return (
        <div className={styles.overlay}>
            <motion.div
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
                <div className={styles.header}>
                    <h2>Edit Rules for Student</h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.body}>
                    <div className={styles.studentName}>{studentName}</div>

                    {error && <div className={styles.errorBanner}>{error}</div>}

                    <div className={styles.optionsGroup}>
                        <div
                            className={`${styles.optionCard} ${action === "unlock_all" ? styles.selected : ""}`}
                            onClick={() => setAction("unlock_all")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Make all modules available</span>
                            </div>
                            <div className={styles.optionDesc}>
                                This will instantly unlock every module in the course for this student.
                            </div>
                        </div>

                        <div
                            className={`${styles.optionCard} ${action === "change_batch" ? styles.selected : ""}`}
                            onClick={() => setAction("change_batch")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Change Batch / Add to Batch</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Move this student to a specific batch.
                            </div>
                            {action === "change_batch" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.dateInputsGrid}>
                                        <div className={styles.dateInputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Select Batch:</label>
                                            <select 
                                                value={selectedBatchId}
                                                onChange={(e) => setSelectedBatchId(e.target.value)}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-color)' }}
                                            >
                                                <option value="">-- No Batch (Remove from batch) --</option>
                                                {batches.map(b => (
                                                    <option key={b.id} value={b.id}>
                                                        {b.name} (Starts: {new Date(b.startDate).toLocaleDateString()})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            className={`${styles.optionCard} ${action === "start_from_today" ? styles.selected : ""}`}
                            onClick={() => setAction("start_from_today")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Start from Enrollment date (Default)</span>
                            </div>
                            <div className={styles.optionDesc}>
                                All are locked & each module will be available following the module rule, starting from the enrollment date.
                            </div>
                        </div>

                        <div
                            className={`${styles.optionCard} ${action === "custom_date" ? styles.selected : ""}`}
                            onClick={() => setAction("custom_date")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Change enrollment date</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Set a custom enrollment date. The student will gain access to modules exactly as if they enrolled on this date.
                            </div>
                            {action === "custom_date" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.dateInputsGrid}>
                                        <div className={styles.dateInputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>New Enrollment Date (Required):</label>
                                            <input 
                                                type="date" 
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            className={`${styles.optionCard} ${action === "week_days" ? styles.selected : ""}`}
                            onClick={() => setAction("week_days")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Week days</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Custom days of the week when modules unlock.
                            </div>
                            {action === "week_days" && (
                                <div className={styles.subConfig}>
                                    <div className={styles.daysGrid}>
                                        {DAYS.map(d => (
                                            <button
                                                key={d.value}
                                                type="button"
                                                className={`${styles.dayBtn} ${daysOfWeek.includes(d.value) ? styles.active : ""}`}
                                                onClick={(e) => { e.stopPropagation(); toggleDay(d.value); }}
                                            >
                                                {d.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            className={`${styles.optionCard} ${action === "custom_interval" ? styles.selected : ""}`}
                            onClick={() => setAction("custom_interval")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>X days interval</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Custom day interval between each module, starting today.
                            </div>
                            {action === "custom_interval" && (
                                <div className={styles.subConfig}>
                                    <div className={styles.intervalInput}>
                                        <input
                                            type="number"
                                            value={intervalDays}
                                            min={1}
                                            onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
                                            onClick={e => e.stopPropagation()}
                                        />
                                        <span>days</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className={styles.footer}>
                    {onOpenAdvanced && (
                        <button className={styles.advancedBtn} onClick={onOpenAdvanced}>
                            Advanced: Edit Individual Modules
                        </button>
                    )}
                    <div className={styles.footerActions}>
                        <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
                            {loading ? <><Loader variant="button" /> Saving...</> : <><Check size={16} /> Save Rules</>}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
