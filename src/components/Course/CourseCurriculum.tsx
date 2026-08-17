import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./CourseCurriculum.module.css";
import { ChevronDown, ChevronRight, Lock, PlayCircle, FolderOpen, Folder, CheckCircle2, FileText, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDisplayDate } from "@/lib/date-format";

export type ContentType = 'youtube' | 'self-hosted' | 'document' | 'quiz';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
    quizId?: string;
    locked?: boolean;
    completed?: boolean;
    availableAt?: string | null;
    attachments?: { name: string; url: string; type?: string; size?: number }[];
    children?: CurriculumNode[];
}

interface NodeProps {
    node: CurriculumNode;
    depth: number;
    onVideoSelect: (node: CurriculumNode) => void;
    activeNodeId?: string;
}

const formatAvailability = (dateValue?: string | null) => {
    if (!dateValue) return "";
    return `${formatDisplayDate(dateValue)} - 10:00 PM`;
};

const areAllChildrenCompleted = (item: CurriculumNode): boolean => {
    if (!item.children || item.children.length === 0) return false;
    
    const check = (list: CurriculumNode[]): boolean => {
        for (const child of list) {
            if (child.type === 'folder') {
                if (child.children && !check(child.children)) return false;
            } else {
                if (!child.completed) return false;
            }
        }
        return true;
    };
    
    return check(item.children);
};

const CurriculumItem = ({ node, depth, onVideoSelect, activeNodeId }: NodeProps) => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(!node.locked);
    const isFolder = node.type === 'folder';
    const isQuiz = node.type === 'quiz';
    const isActive = node.id === activeNodeId;

    const handleClick = () => {
        if (isFolder) {
            if (node.locked) return;
            setIsOpen(!isOpen);
        } else if (isQuiz) {
            if (node.locked) return;
            if (node.quizId) {
                router.push(`/dashboard/quizzes/${node.quizId}`);
            }
        } else {
            if (node.locked) {
                return;
            }
            onVideoSelect(node);
        }
    };

    return (
        <div className={styles.nodeContainer}>
            <button
                className={`${styles.nodeBtn} ${isActive ? styles.activeNode : ''} ${node.locked ? styles.lockedNode : ''}`}
                onClick={handleClick}
                style={{ paddingLeft: `${depth * 20 + 15}px` }}
                disabled={!isFolder && node.locked}
            >
                <div className={styles.nodeLabel}>
                    {isFolder ? (
                        <>
                            {isOpen ? <FolderOpen size={16} className={styles.folderIcon} /> : <Folder size={16} className={styles.folderIcon} />}
                            <span className={styles.title}>{node.title}</span>
                            {node.locked ? (
                                <>
                                    <Lock size={14} className={styles.lockIcon} style={{ marginLeft: '6px' }} />
                                    {node.availableAt && (
                                        <div className={styles.availableAt} style={{ marginLeft: 'auto', fontSize: '0.80rem', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                                            <span>{formatDisplayDate(node.availableAt)}</span>
                                            <span style={{ fontSize: '0.70rem', opacity: 0.8 }}>10:00 PM</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className={areAllChildrenCompleted(node) ? styles.completedBadge : styles.availableNow} style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>
                                    {areAllChildrenCompleted(node) ? "Completed" : "Available"}
                                </span>
                            )}
                        </>
                    ) : isQuiz ? (
                        <>
                            <ClipboardList size={16} className={styles.playIcon} style={{ color: 'var(--primary-color, #6366f1)' }} />
                            <span className={styles.title}>{node.title}</span>
                            {node.duration && <span style={{ fontSize: '0.75rem', opacity: 0.7, marginLeft: '6px' }}>({node.duration})</span>}
                            {node.completed && <CheckCircle2 size={14} className={styles.completedIcon} style={{ marginLeft: 'auto' }} />}
                            {node.locked && (
                                <>
                                    <Lock size={14} className={styles.lockIcon} style={{ marginLeft: 'auto' }} />
                                    {node.availableAt && (
                                        <div className={styles.availableAt} style={{ marginLeft: '6px', fontSize: '0.75rem', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                                            <span>{formatDisplayDate(node.availableAt)}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {node.type === 'document' ? (
                                <FileText size={16} className={styles.playIcon} />
                            ) : (
                                <PlayCircle size={16} className={styles.playIcon} />
                            )}
                            <span className={styles.title}>{node.title}</span>
                            {node.completed && <CheckCircle2 size={14} className={styles.completedIcon} style={{ marginLeft: 'auto' }} />}
                            {node.locked && <Lock size={14} className={styles.lockIcon} style={{ marginLeft: 'auto' }} />}
                        </>
                    )}
                </div>
                {isFolder && !node.locked && (
                    <div className={styles.chevron}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                )}
            </button>

            <AnimatePresence>
                {isFolder && isOpen && node.children && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={styles.childrenContainer}
                    >
                        {node.children.map(child => (
                            <CurriculumItem
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onVideoSelect={onVideoSelect}
                                activeNodeId={activeNodeId}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface Props {
    data: CurriculumNode[];
    onVideoSelect: (node: CurriculumNode) => void;
    activeNodeId?: string;
}

export default function CourseCurriculum({ data, onVideoSelect, activeNodeId }: Props) {
    return (
        <div className={styles.curriculumWrapper}>
            {data.map(node => (
                <CurriculumItem
                    key={node.id}
                    node={node}
                    depth={0}
                    onVideoSelect={onVideoSelect}
                    activeNodeId={activeNodeId}
                />
            ))}
        </div>
    );
}
