import { useState } from "react";
import styles from "./CourseCurriculum.module.css";
import { ChevronDown, ChevronRight, Lock, PlayCircle, FolderOpen, Folder, CheckCircle2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDisplayDate } from "@/lib/date-format";

export type ContentType = 'youtube' | 'self-hosted' | 'document';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
    locked?: boolean;
    completed?: boolean;
    availableAt?: string | null;
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
    return `Available: ${formatDisplayDate(dateValue)}, 10:00 PM`;
};

const CurriculumItem = ({ node, depth, onVideoSelect, activeNodeId }: NodeProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = node.type === 'folder';
    const isActive = node.id === activeNodeId;

    const handleClick = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
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
                        </>
                    ) : (
                        <>
                            {node.type === 'document' ? (
                                <FileText size={16} className={styles.playIcon} />
                            ) : (
                                <PlayCircle size={16} className={styles.playIcon} />
                            )}
                            <span className={styles.title}>{node.title}</span>
                            {node.completed && <CheckCircle2 size={14} className={styles.completedIcon} />}
                            {node.locked && <Lock size={14} className={styles.lockIcon} />}
                            {node.availableAt && (
                                <span className={node.locked ? styles.availableAt : node.completed ? styles.completedBadge : styles.availableNow}>
                                    {node.locked ? formatAvailability(node.availableAt) : node.completed ? "Completed" : "Available"}
                                </span>
                            )}
                        </>
                    )}
                </div>
                {isFolder && (
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
