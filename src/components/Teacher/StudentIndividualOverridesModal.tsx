"use client";

import { useEffect, useMemo, useState } from "react";
import { X, FolderOpen, PlayCircle, Save } from "lucide-react";
import styles from "./StudentIndividualOverridesModal.module.css";
import { motion } from "framer-motion";
import { annotateCurriculumAvailability, BuilderNodeWithAvailability } from "@/lib/teacher-course-builder";
import { useModal } from "@/hooks/useModal";

interface StudentIndividualOverridesModalProps {
    courseId: string;
    userId: string;
    studentName: string;
    selectedCourse: any;
    overrides: any[];
    computedDates: Record<string, string>;
    onClose: () => void;
    onSuccess: () => void;
}

type DraftAvailability = {
    availabilityMode: "inherit" | "available" | "locked";
    availableAt: string;
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
};

const toLocalInputDateTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function StudentIndividualOverridesModal({
    courseId,
    userId,
    studentName,
    selectedCourse,
    overrides,
    computedDates,
    onClose,
    onSuccess,
}: StudentIndividualOverridesModalProps) {
    const [draftAvailability, setDraftAvailability] = useState<Record<string, DraftAvailability>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useModal(true, onClose);

    const studentCurriculum = useMemo(() => {
        if (!selectedCourse?.curriculum) return [];

        return annotateCurriculumAvailability(
            selectedCourse.curriculum,
            computedDates,
            new Date(),
            overrides.map((o) => ({
                lessonNodeId: o.lessonNodeId,
                availabilityMode: o.availabilityMode,
                availableAt: o.availableAt,
            }))
        );
    }, [selectedCourse, computedDates, overrides]);

    useEffect(() => {
        if (!studentCurriculum.length) return;

        const nextDrafts: Record<string, DraftAvailability> = {};
        const currentOverrideMap = new Map(overrides.map((o) => [o.lessonNodeId, o]));

        const walk = (nodes: BuilderNodeWithAvailability[]) => {
            nodes.forEach((node) => {
                const override = currentOverrideMap.get(node.id);
                nextDrafts[node.id] = {
                    availabilityMode: override?.availabilityMode || "inherit",
                    availableAt: toLocalInputDateTime(override?.availableAt || node.availableAt || ""),
                };
                if (node.children?.length) {
                    walk(node.children);
                }
            });
        };

        walk(studentCurriculum);
        setDraftAvailability(nextDrafts);
    }, [studentCurriculum, overrides]);

    const handleDraftChange = (nodeId: string, partial: Partial<DraftAvailability>) => {
        setDraftAvailability((prev) => ({
            ...prev,
            [nodeId]: {
                ...(prev[nodeId] || { availabilityMode: "inherit", availableAt: "" }),
                ...partial,
            },
        }));
    };

    const handleSaveOverride = async (nodeId: string) => {
        const draft = draftAvailability[nodeId];
        if (!draft) return;

        try {
            setSavingKey(nodeId);
            setError(null);
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/teacher/students", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    courseId,
                    userId,
                    lessonNodeId: nodeId,
                    availabilityMode: draft.availabilityMode,
                    availableAt: draft.availabilityMode === "available" ? draft.availableAt || null : null,
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload.error || "Failed to save availability override.");
            }

            onSuccess(); // Triggers a refetch in the parent to get the new overrides
        } catch (saveError: any) {
            setError(saveError.message || "Failed to save availability override.");
        } finally {
            setSavingKey(null);
        }
    };

    const renderNode = (node: BuilderNodeWithAvailability, depth: number) => {
        const draft = draftAvailability[node.id] || {
            availabilityMode: node.availabilityMode || "inherit",
            availableAt: toLocalInputDateTime(node.availabilityOverrideAt || node.availableAt || ""),
        };

        return (
            <div key={node.id} className={styles.nodeWrap} style={{ marginLeft: `${depth * 18}px` }}>
                <div className={styles.nodeRow}>
                    <div className={styles.nodeMeta}>
                        {node.type === "folder" ? <FolderOpen size={16} /> : <PlayCircle size={16} />}
                        <div>
                            <strong>{node.title}</strong>
                            <div className={styles.nodeSubmeta}>
                                <span>{node.type}</span>

                                {node.locked ? <span className={styles.lockedTag}>Locked</span> : <span className={styles.openTag}>Open</span>}
                                {node.availableAt && <span> • {formatDateTime(node.availableAt)}</span>}
                            </div>
                        </div>
                    </div>

                    <div className={styles.nodeControls}>
                        <select
                            value={draft.availabilityMode}
                            onChange={(event) => handleDraftChange(node.id, { availabilityMode: event.target.value as DraftAvailability["availabilityMode"] })}
                        >
                            <option value="inherit">Inherit</option>
                            <option value="available">Available</option>
                            <option value="locked">Locked</option>
                        </select>

                        {draft.availabilityMode === "available" && (
                            <input
                                type="datetime-local"
                                value={draft.availableAt}
                                onChange={(event) => handleDraftChange(node.id, { availableAt: event.target.value })}
                            />
                        )}

                        <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={() => handleSaveOverride(node.id)}
                            disabled={savingKey === node.id}
                        >
                            <Save size={14} /> {savingKey === node.id ? "Saving..." : "Save"}
                        </button>
                    </div>
                </div>

                {node.children?.length ? (
                    <div className={styles.children}>
                        {node.children.map((child) => renderNode(child, depth + 1))}
                    </div>
                ) : null}
            </div>
        );
    };

    return (
        <div className={styles.overlay}>
            <motion.div 
                className={styles.modal} 
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
            >
                <div className={styles.header}>
                    <div className={styles.titleArea}>
                        <h2>Individual Module Overrides</h2>
                        <p>{studentName}</p>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.body}>
                    {error && <div className={styles.errorBanner}>{error}</div>}
                    
                    <div className={styles.treeWrap}>
                        {studentCurriculum.map((node) => renderNode(node, 0))}
                        {studentCurriculum.length === 0 && (
                            <div style={{ color: 'var(--text-muted)' }}>No curriculum available.</div>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
