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
    const [action, setAction] = useState<"current_batch" | "instant" | "fixed_interval" | "groups_per_week" | "day_of_week" | "batch_change" | "custom_date">("current_batch");
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
    const [intervalDays, setIntervalDays] = useState<number>(3);
    const [groupsPerWeek, setGroupsPerWeek] = useState<number>(1);
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
        if (action === "day_of_week" && daysOfWeek.length === 0) {
            setError("Please select at least one day of the week.");
            return;
        }
        if (action === "fixed_interval" && (intervalDays < 1 || isNaN(intervalDays))) {
            setError("Please enter a valid interval greater than 0.");
            return;
        }
        if (action === "groups_per_week" && (groupsPerWeek < 1 || isNaN(groupsPerWeek))) {
            setError("Please enter a valid number of groups per week.");
            return;
        }
        if (action === "custom_date" && !startDate) {
            setError("Please enter a start date.");
            return;
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
                    groupsPerWeek,
                    batchId: action === "batch_change" ? selectedBatchId || null : undefined,
                    startDate: (action === "custom_date" || action === "batch_change") ? startDate : undefined
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to save module availability rules.");
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
        <motion.div 
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className={styles.modal}
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
                <div className={styles.header}>
                    <h2>Change Module Availability</h2>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.body}>
                    <div className={styles.studentName}>{studentName}</div>

                    {error && <div className={styles.errorBanner}>{error}</div>}

                    <div className={styles.optionsGroup}>
                        {/* 1. Current Batch */}
                        <div
                            className={`${styles.optionCard} ${action === "current_batch" ? styles.selected : ""}`}
                            onClick={() => setAction("current_batch")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Current Batch [Default]</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Students continue with batch which he has enrolled into.
                            </div>
                        </div>

                        {/* 2. Instant */}
                        <div
                            className={`${styles.optionCard} ${action === "instant" ? styles.selected : ""}`}
                            onClick={() => setAction("instant")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Instant Unlock (All Unlocked Batch)</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Instantly unlocks all modules and assigns the student to the All Unlocked Batch.
                            </div>
                        </div>

                        {/* 3. Fixed Interval */}
                        <div
                            className={`${styles.optionCard} ${action === "fixed_interval" ? styles.selected : ""}`}
                            onClick={() => setAction("fixed_interval")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Fixed Interval</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Modules unlock after a set number of days.
                            </div>
                            {action === "fixed_interval" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.intervalInput}>
                                        <input
                                            type="number"
                                            value={intervalDays}
                                            min={1}
                                            onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
                                        />
                                        <span>days</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 4. Groups Per Week */}
                        <div
                            className={`${styles.optionCard} ${action === "groups_per_week" ? styles.selected : ""}`}
                            onClick={() => setAction("groups_per_week")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Groups Per Week</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Unlocks a specific number of module groups each week.
                            </div>
                            {action === "groups_per_week" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.intervalInput}>
                                        <input
                                            type="number"
                                            value={groupsPerWeek}
                                            min={1}
                                            onChange={(e) => setGroupsPerWeek(parseInt(e.target.value) || 1)}
                                        />
                                        <span>groups / week</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 5. Day of Week */}
                        <div
                            className={`${styles.optionCard} ${action === "day_of_week" ? styles.selected : ""}`}
                            onClick={() => setAction("day_of_week")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Day of Week</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Modules unlock on specific days of the week.
                            </div>
                            {action === "day_of_week" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
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

                        {/* 6. Batch Change */}
                        <div
                            className={`${styles.optionCard} ${action === "batch_change" ? styles.selected : ""}`}
                            onClick={() => setAction("batch_change")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Batch Change</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Change the current batch of a student.
                            </div>
                            {action === "batch_change" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.dateInputsGrid}>
                                        <div className={styles.dateInputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Select Batch:</label>
                                            <select 
                                                value={selectedBatchId}
                                                onChange={(e) => setSelectedBatchId(e.target.value)}
                                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-color)' }}
                                            >
                                                {!batches.some(b => b.name.toLowerCase().includes('start today') || b.name.toLowerCase().includes('custom')) && (
                                                    <option value="">🚀 Start Today Batch (Requires Custom Enrollment Date)</option>
                                                )}
                                                {batches.map(b => {
                                                    const nameLower = b.name.toLowerCase();
                                                    const isCustom = nameLower.includes('start today') || nameLower.includes('custom');
                                                    let label = `🗓 ${b.name} (Starts: ${new Date(b.startDate).toLocaleDateString()})`;
                                                    if (isCustom) {
                                                        label = '🚀 Start Today Batch (Requires Custom Enrollment Date)';
                                                    } else if (nameLower.includes('all unlocked') || nameLower.includes('instant')) {
                                                        label = '⚡ All Unlocked Batch (Instant Access)';
                                                    }
                                                    return (
                                                        <option key={b.id} value={b.id}>
                                                            {label}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        {(() => {
                                            const selBatch = batches.find(b => b.id === selectedBatchId);
                                            const isCustom = !selectedBatchId || selBatch?.name.toLowerCase().includes('start today') || selBatch?.name.toLowerCase().includes('custom');
                                            const displayDate = isCustom 
                                                ? startDate 
                                                : (selBatch?.startDate ? new Date(selBatch.startDate).toISOString().split('T')[0] : startDate);

                                            return (
                                                <div className={styles.dateInputGroup} style={{ gridColumn: 'span 2', marginTop: '12px' }}>
                                                    <label>{isCustom ? 'Custom Enrollment Date (Required):' : 'Enrollment Start Date (Set by Batch):'}</label>
                                                    <input 
                                                        type="date" 
                                                        value={displayDate}
                                                        disabled={!isCustom}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        style={!isCustom ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 7. Custom Date */}
                        <div
                            className={`${styles.optionCard} ${action === "custom_date" ? styles.selected : ""}`}
                            onClick={() => setAction("custom_date")}
                        >
                            <div className={styles.optionHeader}>
                                <div className={styles.radio}></div>
                                <span className={styles.optionTitle}>Custom Date</span>
                            </div>
                            <div className={styles.optionDesc}>
                                Every student is enrolled from a custom date, assigned to the Start Today Batch.
                            </div>
                            {action === "custom_date" && (
                                <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                                    <div className={styles.dateInputsGrid}>
                                        <div className={styles.dateInputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label>Custom Enrollment Date (Required):</label>
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
        </motion.div>
    );
}
