import { useState, useEffect, useCallback, useMemo } from "react";
import Loader from "@/components/UI/Loader";
import styles from "./ModuleLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, FileText, ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, GripVertical, UploadCloud, ClipboardList, Search, CheckSquare, PlusCircle, ArrowLeft, ExternalLink, AlertCircle, Check } from "lucide-react";

import { motion, AnimatePresence } from "framer-motion";
import AlertModal from "@/components/UI/AlertModal";
import ConfirmModal from "@/components/UI/ConfirmModal";
import { useModal } from "@/hooks/useModal";


export type ContentType = 'youtube' | 'self-hosted' | 'document' | 'quiz';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
    quizId?: string;
    parentId?: string | null;
    attachments?: { name: string; url: string; type?: string; size?: number }[];
    children?: CurriculumNode[];
}

const findNodeInTree = (nodes: CurriculumNode[], id: string): CurriculumNode | undefined => {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
            const found = findNodeInTree(node.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    m4v: 'video/mp4',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
};

const getUploadContentType = (file: File) => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return MIME_TYPE_BY_EXTENSION[ext] || '';
};

interface FlatNode {
    id: string;
    title: string;
    type: string;
    url: string | null;
    attachments: any;
    duration: string | null;
    parentId: string | null;
    sortOrder: number;
}

function buildTree(flatNodes: FlatNode[]): CurriculumNode[] {
    const map = new Map<string, CurriculumNode>();
    const roots: CurriculumNode[] = [];

    for (const node of flatNodes) {
        map.set(node.id, {
            id: node.id,
            title: node.title,
            type: node.type as CurriculumNode['type'],
            url: node.url || undefined,
            quizId: node.type === 'quiz' ? (node.url || node.id) : undefined,
            attachments: node.attachments || undefined,
            duration: node.duration || undefined,
            children: node.type === 'folder' ? [] : undefined,
        });
    }

    for (const node of flatNodes) {
        const treeNode = map.get(node.id)!;
        if (node.parentId && map.has(node.parentId)) {
            map.get(node.parentId)!.children!.push(treeNode);
        } else if (!node.parentId) {
            roots.push(treeNode);
        }
    }

    return roots;
}

interface NodeProps {
    node: CurriculumNode;
    depth: number;
    onDelete: (id: string) => void;
    onEdit: (node: CurriculumNode) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    siblingIds: string[];
    dragNodeId: string | null;
    dragOverNodeId: string | null;
    dragOverPosition: 'above' | 'below' | null;
    onDragStart: (id: string) => void;
    onDragEnd: () => void;
    onDragOver: (targetId: string, e: React.DragEvent) => void;
    onDragLeave: (targetId: string) => void;
    onDrop: (draggedId: string, targetId: string, position: 'above' | 'below', siblingIds: string[]) => void;
}

const LibraryItem = ({ node, depth, onDelete, onEdit, onMove, siblingIds, dragNodeId, dragOverNodeId, dragOverPosition, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: NodeProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = node.type === 'folder';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) setIsOpen(!isOpen);
    };

    const isThisDragging = dragNodeId === node.id;
    const isDropTarget = dragNodeId && dragNodeId !== node.id && dragOverNodeId === node.id;
    let rowClass = `${styles.nodeRow} ${isFolder ? styles.folderRow : styles.videoRow}`;
    if (isThisDragging) rowClass += ` ${styles.dragging}`;
    if (isDropTarget && dragOverPosition === 'above') rowClass += ` ${styles.dragOverAbove}`;
    if (isDropTarget && dragOverPosition === 'below') rowClass += ` ${styles.dragOverBelow}`;

    const handleRowDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onDragOver(node.id, e);
    };

    const handleRowDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragNodeId || dragNodeId === node.id) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        const position: 'above' | 'below' = y < rect.height / 2 ? 'above' : 'below';
        onDrop(dragNodeId, node.id, position, siblingIds);
    };

    return (
        <div className={styles.nodeContainer}>
            <div
                className={rowClass}
                style={{ paddingLeft: `${depth * 25 + 15}px` }}
                onClick={handleToggle}
                onDragOver={handleRowDragOver}
                onDragLeave={() => onDragLeave(node.id)}
                onDrop={handleRowDrop}
            >
                <div className={styles.nodeLabel}>
                    <div
                        className={styles.dragHandle}
                        draggable
                        onDragStart={(e) => { 
                            e.stopPropagation(); 
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', node.id);
                            onDragStart(node.id); 
                        }}
                        onDragEnd={(e) => { e.stopPropagation(); onDragEnd(); }}
                        title="Drag to reorder"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical size={14} />
                    </div>
                    {isFolder ? (
                        <>
                            {isOpen ? <FolderOpen size={18} className={styles.folderIcon} /> : <Folder size={18} className={styles.folderIcon} />}
                            <span className={styles.folderTitle}>{node.title}</span>
                            <span className={styles.itemCount}>({node.children?.length || 0} items)</span>
                            {isThisDragging && <span className={styles.draggingBadge}>Moving</span>}
                        </>
                    ) : (
                        <>
                            {node.type === 'document' ? (
                                <FileText size={18} className={styles.playIcon} />
                            ) : node.type === 'quiz' ? (
                                <ClipboardList size={18} className={styles.playIcon} style={{ color: '#8b5cf6' }} />
                            ) : (
                                <PlayCircle size={18} className={styles.playIcon} />
                            )}
                            <span className={styles.videoTitle}>{node.title}</span>
                            {node.type === 'quiz' && (
                                <span className={styles.quizBadge}>Quiz{node.duration ? ` • ${node.duration}` : ''}</span>
                            )}
                            {isThisDragging && <span className={styles.draggingBadge}>Moving</span>}
                        </>
                    )}

                </div>

                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'up')} title="Move Up"><ArrowUp size={14} /></button>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'down')} title="Move Down"><ArrowDown size={14} /></button>
                    <button className={styles.actionBtn} title="Edit" onClick={() => onEdit(node)}>
                        <Edit2 size={14} />
                    </button>
                    <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(node.id)} title="Delete">
                        <Trash2 size={14} />
                    </button>
                    {isFolder && (
                        <div className={styles.chevron}>
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                    )}
                </div>
            </div>

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
                            <LibraryItem
                                key={child.id}
                                node={child}
                                depth={depth + 1}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onMove={onMove}
                                siblingIds={node.children!.map(c => c.id)}
                                dragNodeId={dragNodeId}
                                dragOverNodeId={dragOverNodeId}
                                dragOverPosition={dragOverPosition}
                                onDragStart={onDragStart}
                                onDragEnd={onDragEnd}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function ModuleLibraryManager() {
    const [activeRootId, setActiveRootId] = useState<string | null>(null);
    const [libraryData, setLibraryData] = useState<CurriculumNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [path, setPath] = useState<CurriculumNode[]>([]);

    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [quizModalTargetTitle, setQuizModalTargetTitle] = useState("");
    const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([]);
    const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
    const [quizSearch, setQuizSearch] = useState("");
    const [loadingQuizzes, setLoadingQuizzes] = useState(false);
    const [savingQuizzes, setSavingQuizzes] = useState(false);

    useModal(isFolderModalOpen, () => setIsFolderModalOpen(false));
    useModal(isVideoModalOpen, () => setIsVideoModalOpen(false));
    useModal(isDocModalOpen, () => setIsDocModalOpen(false));
    useModal(isEditModalOpen, () => setIsEditModalOpen(false));
    useModal(isQuizModalOpen, () => setIsQuizModalOpen(false));
    const [editingNode, setEditingNode] = useState<CurriculumNode | null>(null);
    const [activeParentId, setActiveParentId] = useState<string | null>(null);

    const [folderTitle, setFolderTitle] = useState("");
    const [videoTitle, setVideoTitle] = useState("");
    const [videoType, setVideoType] = useState<ContentType>('youtube');
    const [videoUrl, setVideoUrl] = useState("");
    const [videoDuration, setVideoDuration] = useState("");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [docAttachments, setDocAttachments] = useState<{ name: string; url?: string; file?: File }[]>([]);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Quiz Edit & Replace Modal States
    const [quizEditNode, setQuizEditNode] = useState<CurriculumNode | null>(null);
    const [isEditQuizModalOpen, setIsEditQuizModalOpen] = useState(false);
    const [selectedReplacementQuizId, setSelectedReplacementQuizId] = useState<string>('');
    const [replacementSearch, setReplacementSearch] = useState<string>('');
    const [isSavingQuizReplacement, setIsSavingQuizReplacement] = useState<boolean>(false);

    // Alert & Confirm Modal States

    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title?: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({ isOpen: false, message: '', type: 'info' });

    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title?: string;
        message: React.ReactNode | string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info' | 'primary';
        isSubmitting?: boolean;
        onConfirm: () => void | Promise<void>;
    }>({ isOpen: false, message: '', onConfirm: () => {} });

    const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
        setAlertConfig({ isOpen: true, message, type, title });
    };

    const showConfirm = (options: {
        title?: string;
        message: React.ReactNode | string;
        confirmText?: string;
        variant?: 'danger' | 'warning' | 'info' | 'primary';
        onConfirm: () => void | Promise<void>;
    }) => {
        setConfirmConfig({
            isOpen: true,
            title: options.title,
            message: options.message,
            confirmText: options.confirmText || 'Confirm',
            variant: options.variant || 'danger',
            isSubmitting: false,
            onConfirm: options.onConfirm,
        });
    };

    const [dragNodeId, setDragNodeId] = useState<string | null>(null);
    const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);

    const handleDragStart = (id: string) => { setDragNodeId(id); };
    const handleDragEnd = () => { setDragNodeId(null); setDragOverNodeId(null); setDragOverPosition(null); };

    const handleDragOver = (targetId: string, e: React.DragEvent) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        setDragOverNodeId(targetId);
        setDragOverPosition(y < rect.height / 2 ? 'above' : 'below');
    };

    const handleDragLeave = (targetId: string) => {
        setDragOverNodeId(prev => prev === targetId ? null : prev);
        setDragOverPosition(null);
    };

    const handleDrop = async (draggedId: string, targetId: string, position: 'above' | 'below', ids: string[]) => {
        setDragNodeId(null);
        setDragOverNodeId(null);
        setDragOverPosition(null);

        if (draggedId === targetId) return;

        const targetIdx = ids.indexOf(targetId);
        if (targetIdx === -1) return;

        const draggedIdx = ids.indexOf(draggedId);
        let newIndex: number;
        if (draggedIdx === -1) {
            newIndex = position === 'above' ? targetIdx : targetIdx + 1;
        } else {
            newIndex = position === 'above'
                ? (draggedIdx < targetIdx ? targetIdx - 1 : targetIdx)
                : (draggedIdx < targetIdx ? targetIdx : targetIdx + 1);
        }

        try {
            const res = await fetch('/api/teacher/video-library/reorder', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id: draggedId, targetIndex: newIndex }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to reorder.");
            }
            await fetchLibrary();
        } catch (err: any) {
            showAlert(err.message || 'Failed to move item.', 'error');
        }
    };


    const getAuthHeaders = useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const fetchLibrary = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch('/api/teacher/video-library', { headers: getAuthHeaders() });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to load library.');
            }
            const data = await res.json();
            const tree = buildTree(data.nodes);
            setLibraryData(tree);
        } catch (err: any) {
            setError(err.message || 'Failed to load library.');
        } finally {
            setIsLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => { fetchLibrary(); }, [fetchLibrary]);



    const handleAddFolderClick = (parentId?: string) => { setActiveParentId(parentId || null); setIsFolderModalOpen(true); };
    const handleAddVideoClick = (parentId: string) => { 
        setActiveParentId(parentId); 
        setVideoType('youtube');
        setVideoTitle(''); setVideoUrl(''); setVideoDuration(''); setVideoFile(null); setUploadProgress(0);
        setIsVideoModalOpen(true); 
    };
    const handleAddDocClick = (parentId: string) => { 
        setActiveParentId(parentId); 
        setVideoType('document');
        setVideoTitle(''); setVideoUrl(''); setVideoDuration(''); setVideoFile(null); setUploadProgress(0);
        setDocAttachments([]);
        setIsDocModalOpen(true); 
    };
    const handleOpenQuizModal = async (targetFolderId: string, folderTitle: string) => {
        setActiveParentId(targetFolderId);
        setQuizModalTargetTitle(folderTitle || "Folder");
        setSelectedQuizIds([]);
        setQuizSearch("");
        setIsQuizModalOpen(true);
        setLoadingQuizzes(true);

        try {
            const res = await fetch('/api/quiz?status=published', { headers: getAuthHeaders() });
            if (res.ok) {
                const data = await res.json();
                setAvailableQuizzes(data.quizzes || []);
            } else {
                const res2 = await fetch('/api/quiz', { headers: getAuthHeaders() });
                if (res2.ok) {
                    const data2 = await res2.json();
                    setAvailableQuizzes(data2.quizzes || []);
                }
            }
        } catch (err: any) {
            console.error("Failed to fetch quizzes", err);
        } finally {
            setLoadingQuizzes(false);
        }
    };

    const handleSubmitQuizzes = async () => {
        if (selectedQuizIds.length === 0 || !activeParentId || savingQuizzes) return;
        setSavingQuizzes(true);
        try {
            const res = await fetch('/api/teacher/video-library', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    type: 'quiz',
                    quizIds: selectedQuizIds,
                    parentId: activeParentId,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add quizzes.');

            setIsQuizModalOpen(false);
            setSelectedQuizIds([]);
            showAlert(`Successfully added ${selectedQuizIds.length} quiz(zes) to folder!`, 'success');
            await fetchLibrary();
        } catch (err: any) {
            showAlert(err.message || 'Failed to add quizzes.', 'error');
        } finally {
            setSavingQuizzes(false);
        }
    };

    const filteredQuizzes = useMemo(() => {
        if (!quizSearch.trim()) return availableQuizzes;
        const q = quizSearch.toLowerCase();
        return availableQuizzes.filter((quiz: any) =>
            String(quiz.title || '').toLowerCase().includes(q)
        );
    }, [availableQuizzes, quizSearch]);

    const filteredReplacementQuizzes = useMemo(() => {
        if (!replacementSearch.trim()) return availableQuizzes;
        const q = replacementSearch.toLowerCase();
        return availableQuizzes.filter((quiz: any) =>
            String(quiz.title || '').toLowerCase().includes(q)
        );
    }, [availableQuizzes, replacementSearch]);

    const handleSaveQuizReplacement = async () => {
        if (!quizEditNode || !selectedReplacementQuizId || isSavingQuizReplacement) return;
        setIsSavingQuizReplacement(true);
        try {
            const res = await fetch(`/api/teacher/video-library/${quizEditNode.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    type: 'quiz',
                    quizId: selectedReplacementQuizId,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Failed to replace quiz.');

            setIsEditQuizModalOpen(false);
            setQuizEditNode(null);
            showAlert('Quiz assignment updated successfully!', 'success');
            await fetchLibrary();
        } catch (err: any) {
            showAlert(err.message || 'Failed to update quiz assignment.', 'error');
        } finally {
            setIsSavingQuizReplacement(false);
        }
    };


    const formatDuration = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const uploadFileWithProgress = async (file: File, token: string | null): Promise<any> => {
        const contentType = getUploadContentType(file);

        // Step 1: Get upload config from API (lightweight JSON, no file bytes)
        const configRes = await fetch('/api/teacher/uploads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                filename: file.name,
                size: file.size,
                contentType,
            }),
        });

        const config = await configRes.json();
        if (!configRes.ok) {
            return { error: config.error || 'Failed to initiate upload.' };
        }

        // Step 2: Upload file directly to Hostinger (bypasses Cloudflare Workers)
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', config.uploadUrl);
            xhr.setRequestHeader('X-Upload-Token', config.token);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        if (res.success) {
                            resolve({
                                url: config.finalUrl,
                                storagePath: `${config.folderPath}/${config.fileName}`,
                                fileName: config.fileName,
                                bytes: file.size,
                            });
                        } else {
                            resolve({ error: res.error || 'Upload failed on storage server.' });
                        }
                    } catch {
                        resolve({ error: 'Invalid response from storage server.' });
                    }
                } else {
                    try {
                        const res = JSON.parse(xhr.responseText);
                        resolve({ error: res.error || `Upload failed with status ${xhr.status}.` });
                    } catch {
                        resolve({
                            error: xhr.responseText?.trim() || `Upload failed with status ${xhr.status}.`,
                        });
                    }
                }
            };

            xhr.onerror = () => reject(new Error('Unable to reach the storage server. Check the Hostinger deployment, HTTPS, and CORS settings.'));
            xhr.onabort = () => reject(new Error('Upload was cancelled.'));

            const formData = new FormData();
            formData.append('file', file);
            formData.append('folderPath', config.folderPath);
            formData.append('fileName', config.fileName);
            xhr.send(formData);
        });
    };

    const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        showConfirm({
            title: 'Delete Item?',
            message: 'Are you sure you want to delete this item? This will also permanently remove all nested content inside it.',
            confirmText: 'Delete Item',
            variant: 'danger',
            onConfirm: async () => {
                try {
                    if (id === activeRootId) setActiveRootId(null);
                    const res = await fetch(`/api/teacher/video-library/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || 'Failed to delete.');
                    }
                    setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                    showAlert('Item deleted successfully.', 'success');
                    await fetchLibrary();
                } catch (err: any) {
                    showAlert(err.message || 'Failed to delete item.', 'error');
                }
            }
        });
    };

    const handleMoveItem = async (id: string, direction: 'up' | 'down') => {
        try {
            const res = await fetch('/api/teacher/video-library/reorder', { 
                method: 'POST', 
                headers: getAuthHeaders(), 
                body: JSON.stringify({ id, direction }) 
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to reorder.");
            }
            await fetchLibrary();
        } catch (err: any) { 
            showAlert(err.message || 'Failed to move item.', 'error'); 
        }
    };

    const handleEditClick = async (node: CurriculumNode, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (node.type === 'quiz') {
            const qId = node.url || node.quizId || '';
            setQuizEditNode(node);
            setSelectedReplacementQuizId(qId);
            setReplacementSearch('');
            setIsEditQuizModalOpen(true);

            // Fetch latest quizzes list
            setLoadingQuizzes(true);
            try {
                const res = await fetch('/api/quiz', { headers: getAuthHeaders() });
                if (res.ok) {
                    const data = await res.json();
                    setAvailableQuizzes(data.quizzes || []);
                }
            } catch (err) {
                console.error("Failed to load quizzes", err);
            } finally {
                setLoadingQuizzes(false);
            }
            return;
        }
        setEditingNode(node);

        setFolderTitle(node.title);
        setVideoTitle(node.title);
        setVideoUrl(node.url || "");
        setVideoDuration(node.duration || "");
        setVideoType(node.type === 'folder' ? 'youtube' : node.type as ContentType);
        setVideoFile(null);
        setDocAttachments(node.attachments || []);
        setUploadProgress(0);
        setIsEditModalOpen(true);
    };

    const handleRootClick = (node: CurriculumNode) => { setActiveRootId(node.id); setPath([node]); };
    const handleChildFolderClick = (node: CurriculumNode) => {
        setActiveRootId(node.id);
        setPath([...path, node]);
    };
    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) { setActiveRootId(null); setPath([]); }
        else { const nextPath = path.slice(0, index + 1); setPath(nextPath); setActiveRootId(nextPath[nextPath.length - 1].id); }
    };

    const submitFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderTitle.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/teacher/video-library', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ title: folderTitle.trim(), type: 'folder', parentId: activeParentId || null }) });
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to create folder.'); }
            setFolderTitle(""); 
            setIsFolderModalOpen(false); 
            showAlert('Folder created successfully.', 'success');
            await fetchLibrary();
        } catch (err: any) { 
            showAlert(err.message || 'Failed to create folder.', 'error'); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    const submitVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTitle.trim() || !activeParentId || isSubmitting) return;

        if (videoType === 'youtube' && !videoUrl.trim()) { 
            showAlert('YouTube URL is required.', 'warning'); 
            return; 
        }
        if (videoType === 'self-hosted' && !videoUrl.trim() && !videoFile) { 
            showAlert('Please upload a video file or provide a direct URL.', 'warning'); 
            return; 
        }
        if (videoType === 'document' && docAttachments.length === 0) { 
            showAlert('Please add at least one document attachment.', 'warning'); 
            return; 
        }

        setIsSubmitting(true);
        try {
            let resolvedVideoUrl = videoUrl.trim() || null;
            const finalAttachments = videoType === 'document' ? [...docAttachments] : undefined;

            if (videoType === 'self-hosted' && videoFile) {
                setUploadingVideo(true);
                setUploadProgress(0);
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                const uploadData = await uploadFileWithProgress(videoFile, token);
                if (uploadData.error) throw new Error(uploadData.error);
                resolvedVideoUrl = typeof uploadData.url === 'string' ? uploadData.url : null;
            }

            if (videoType === 'document' && finalAttachments) {
                setUploadingVideo(true);
                for (let i = 0; i < finalAttachments.length; i++) {
                    const att = finalAttachments[i];
                    if (att.file) {
                        setUploadProgress(0);
                        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                        const uploadData = await uploadFileWithProgress(att.file, token);
                        if (uploadData.error) throw new Error(uploadData.error);
                        att.url = typeof uploadData.url === 'string' ? uploadData.url : undefined;
                        delete att.file;
                    }
                }
            }

            const res = await fetch('/api/teacher/video-library', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ title: videoTitle.trim(), type: videoType, url: resolvedVideoUrl, attachments: finalAttachments, duration: videoDuration.trim() || null, parentId: activeParentId }) });
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to add module.'); }

            setVideoTitle(""); setVideoUrl(""); setVideoDuration(""); setVideoFile(null); setDocAttachments([]); setIsVideoModalOpen(false); setIsDocModalOpen(false); 
            showAlert('Module added successfully.', 'success');
            await fetchLibrary();
        } catch (err: any) { 
            showAlert(err.message || 'Failed to add module.', 'error'); 
        } finally { 
            setUploadingVideo(false); 
            setIsSubmitting(false); 
        }
    };

    const submitEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingNode || isSubmitting) return;

        const isFolder = editingNode.type === 'folder';
        const title = isFolder ? folderTitle : videoTitle;

        if (!title.trim()) return;

        setIsSubmitting(true);
        try {
            let finalUrl = videoUrl.trim() || null;
            const finalAttachments = videoType === 'document' ? [...docAttachments] : undefined;

            if (!isFolder && videoType === 'self-hosted' && videoFile) {
                setUploadingVideo(true);
                setUploadProgress(0);
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                const uploadData = await uploadFileWithProgress(videoFile, token);
                if (uploadData.error) throw new Error(uploadData.error);
                finalUrl = typeof uploadData.url === 'string' ? uploadData.url : null;
            }

            if (!isFolder && videoType === 'document' && finalAttachments) {
                setUploadingVideo(true);
                for (let i = 0; i < finalAttachments.length; i++) {
                    const att = finalAttachments[i];
                    if (att.file) {
                        setUploadProgress(0);
                        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                        const uploadData = await uploadFileWithProgress(att.file, token);
                        if (uploadData.error) throw new Error(uploadData.error);
                        att.url = typeof uploadData.url === 'string' ? uploadData.url : undefined;
                        delete att.file;
                    }
                }
            }

            const body: any = { title: title.trim() };
            if (!isFolder) { body.url = finalUrl; body.duration = videoDuration.trim() || null; body.type = videoType; }
            if (videoType === 'document') { body.attachments = finalAttachments; }

            const res = await fetch(`/api/teacher/video-library/${editingNode.id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Failed to update.'); }

            setIsEditModalOpen(false); setEditingNode(null); 
            showAlert('Item updated successfully.', 'success');
            await fetchLibrary();
        } catch (err: any) { 
            showAlert(err.message || 'Failed to update item.', 'error'); 
        } finally { 
            setUploadingVideo(false); 
            setIsSubmitting(false); 
        }
    };


    const handleFileSelect = (file: File | null) => {
        setVideoFile(file);
        if (file && file.type.startsWith('video/')) {
            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.src = objectUrl;
            video.onloadedmetadata = () => {
                setVideoDuration(formatDuration(video.duration));
                URL.revokeObjectURL(objectUrl);
            };
        }
    };

    const activeRootNode = activeRootId ? findNodeInTree(libraryData, activeRootId) : undefined;

    if (isLoading) {
        return (
            <div className={styles.managerContainer}>
                <div className={styles.emptyState}>
                    <Loader variant="inline" text="Loading modules..." />
                    <h3>Loading Module Library...</h3>
                    <p>Fetching your organized content.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={styles.managerContainer}>
                <div className={styles.emptyState}>
                    <X size={48} className={styles.emptyIcon} style={{ color: '#ef4444' }} />
                    <h3>Failed to Load Library</h3>
                    <p>{error}</p>
                    <button className={styles.primaryBtn} onClick={() => { setIsLoading(true); fetchLibrary(); }} style={{ marginTop: '1rem' }}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.managerContainer}>
            {!activeRootId && (
                <div className={styles.topBar}>
                    <button className={styles.primaryBtn} onClick={() => handleAddFolderClick()}>
                        <Plus size={18} /> New Root Folder
                    </button>
                </div>
            )}

            {!activeRootId ? (
                <>
                    {libraryData.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} className={styles.emptyIcon} />
                            <h3>Your Library is Empty</h3>
                            <p>Create a root folder to start organizing your modules.</p>
                        </div>
                    ) : (
                        <div className={styles.libraryGrid}>
                            {libraryData.map(node => (
                                    <motion.div
                                        key={node.id}
                                        className={styles.rootCard}
                                        onClick={() => handleRootClick(node)}
                                        layoutId={`card-${node.id}`}>
                                        <div className={styles.rootActions}>
                                        <button
                                            className={styles.actionBtn}
                                            title="Move Up"
                                            onClick={(e) => { e.stopPropagation(); handleMoveItem(node.id, 'up'); }}
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            className={styles.actionBtn}
                                            title="Move Down"
                                            onClick={(e) => { e.stopPropagation(); handleMoveItem(node.id, 'down'); }}
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            className={styles.actionBtn}
                                            title="Edit"
                                            onClick={(e) => handleEditClick(node, e)}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                            onClick={(e) => handleDeleteClick(node.id, e)}
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className={styles.rootIconWrapper}>
                                        <FolderOpen size={28} />
                                    </div>
                                    <div>
                                        <h3 className={styles.rootTitle}>{node.title}</h3>
                                        <span className={styles.rootMeta}>{node.children?.length || 0} items inside</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </>
            ) : path.length === 1 ? (
                <motion.div className={styles.treeContainer} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <div className={styles.breadcrumbBar}>
                        <button className={styles.breadcrumbLink} onClick={() => handleBreadcrumbClick(-1)}>Library</button>
                        {path.map((node, i) => (
                            <span key={node.id}>
                                <ChevronRight size={14} className={styles.breadcrumbSep} />
                                <button className={`${styles.breadcrumbLink} ${i === path.length - 1 ? styles.active : ''}`} onClick={() => handleBreadcrumbClick(i)}>{node.title}</button>
                            </span>
                        ))}
                    </div>

                    <div className={styles.activeViewHeader}>
                        <button className={styles.backBtn} onClick={() => handleBreadcrumbClick(path.length - 2)}>
                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
                        </button>
                        <h3 className={styles.activeRootTitle}>{activeRootNode?.title}</h3>
                        
                        <div className={styles.toolbar}>
                            {String(activeRootNode?.title || '').trim().toLowerCase() === 'all resources' ? (
                                <button className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId!)} title="Add Document">
                                    <FileText size={16} /> Document
                                </button>
                            ) : (String(activeRootNode?.title || '').trim().toLowerCase() === 'all quizes' || String(activeRootNode?.title || '').trim().toLowerCase() === 'all quizzes') ? (
                                <button className={styles.toolbarBtn} onClick={() => handleOpenQuizModal(activeRootId!, activeRootNode?.title || '')} title="Add Quiz">
                                    <PlusCircle size={16} /> Add Quiz
                                </button>
                            ) : path.length === 1 && activeRootNode?.parentId === null ? (
                                <>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddFolderClick(activeRootId!)} title="Create Folder">
                                        <Folder size={16} /> Folder
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddVideoClick(activeRootId!)} title="Add Video">
                                        <Video size={16} /> Video
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId!)} title="Add Document">
                                        <FileText size={16} /> Document
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleOpenQuizModal(activeRootId!, activeRootNode?.title || '')} title="Add Quiz">
                                        <ClipboardList size={16} /> Quiz
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddFolderClick(activeRootId!)} title="Create Folder">
                                        <Folder size={16} /> Folder
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddVideoClick(activeRootId!)} title="Add Video">
                                        <Video size={16} /> Video
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId!)} title="Add Document">
                                        <FileText size={16} /> Document
                                    </button>
                                    <button className={styles.toolbarBtn} onClick={() => handleOpenQuizModal(activeRootId!, activeRootNode?.title || '')} title="Add Quiz">
                                        <ClipboardList size={16} /> Quiz
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {(!activeRootNode?.children || activeRootNode.children.length === 0) ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} className={styles.emptyIcon} />
                            <h3>Folder is Empty</h3>
                            <p>Add subfolders, quizzes, or modules to construct this section.</p>
                        </div>
                    ) : (
                        <div className={styles.libraryGrid} style={{ padding: '20px' }}>
                            {activeRootNode.children.map(node => (
                                <motion.div
                                    key={node.id}
                                    className={styles.rootCard}
                                    onClick={() => node.type === 'folder' ? handleChildFolderClick(node) : null}
                                    layoutId={`card-${node.id}`}
                                >
                                    <div className={styles.rootActions}>
                                        <button
                                            className={styles.actionBtn}
                                            title="Move Up"
                                            onClick={(e) => { e.stopPropagation(); handleMoveItem(node.id, 'up'); }}
                                        >
                                            <ArrowUp size={14} />
                                        </button>
                                        <button
                                            className={styles.actionBtn}
                                            title="Move Down"
                                            onClick={(e) => { e.stopPropagation(); handleMoveItem(node.id, 'down'); }}
                                        >
                                            <ArrowDown size={14} />
                                        </button>
                                        <button
                                            className={styles.actionBtn}
                                            title="Edit"
                                            onClick={(e) => handleEditClick(node, e)}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                            onClick={(e) => handleDeleteClick(node.id, e)}
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className={styles.rootIconWrapper} style={node.type === 'quiz' ? { background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' } : undefined}>
                                        {node.type === 'folder' 
                                            ? (String(node.title).trim().toLowerCase() === 'all quizes' || String(node.title).trim().toLowerCase() === 'all quizzes'
                                                ? <ClipboardList size={28} style={{ color: '#8b5cf6' }} />
                                                : (String(node.title).trim().toLowerCase() === 'all resources'
                                                    ? <FileText size={28} style={{ color: '#3b82f6' }} />
                                                    : <FolderOpen size={28} />))
                                            : (node.type === 'document' 
                                                ? <FileText size={28} /> 
                                                : (node.type === 'quiz' 
                                                    ? <ClipboardList size={28} style={{ color: '#8b5cf6' }} /> 
                                                    : <PlayCircle size={28} />))}
                                    </div>
                                    <div>
                                        <h3 className={styles.rootTitle}>{node.title}</h3>
                                        <span className={styles.rootMeta}>
                                            {node.type === 'folder' 
                                                ? (String(node.title).trim().toLowerCase() === 'all quizes' || String(node.title).trim().toLowerCase() === 'all quizzes'
                                                    ? `${node.children?.length || 0} quizzes inside`
                                                    : (String(node.title).trim().toLowerCase() === 'all resources'
                                                        ? `${node.children?.length || 0} documents inside`
                                                        : `${node.children?.length || 0} items inside`))
                                                : node.type === 'document' 
                                                    ? 'Document' 
                                                    : node.type === 'quiz'
                                                        ? (node.duration ? `Quiz • ${node.duration}` : 'Quiz')
                                                        : (node.duration ? `Duration: ${node.duration}` : 'Video')}
                                        </span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>
            ) : (
                <motion.div className={styles.treeContainer} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                    <div className={styles.breadcrumbBar}>
                        <button className={styles.breadcrumbLink} onClick={() => handleBreadcrumbClick(-1)}>Library</button>
                        {path.map((node, i) => (
                            <span key={node.id} className={styles.breadcrumbSegment}>
                                <ChevronRight size={13} className={styles.breadcrumbSep} />
                                <button 
                                    className={`${styles.breadcrumbLink} ${i === path.length - 1 ? styles.active : ''}`} 
                                    onClick={() => handleBreadcrumbClick(i)}
                                    title={node.title}
                                >
                                    {node.title}
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className={styles.activeViewHeader}>
                        <div className={styles.headerLeft}>
                            <button 
                                type="button"
                                className={styles.backBtn} 
                                onClick={() => handleBreadcrumbClick(path.length - 2)}
                                title="Go back to parent folder"
                            >
                                <ArrowLeft size={16} />
                                <span>Back</span>
                            </button>
                            <div className={styles.headerTitleGroup}>
                                <h3 className={styles.activeRootTitle} title={activeRootNode?.title}>
                                    {activeRootNode?.title}
                                </h3>
                                <span className={styles.headerCountBadge}>
                                    {activeRootNode?.children?.length || 0} {activeRootNode?.children?.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                        </div>
                        
                        <div className={styles.toolbar}>
                            {String(activeRootNode?.title || '').trim().toLowerCase() === 'all resources' ? (
                                <button type="button" className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId!)} title="Add Document">
                                    <FileText size={15} /> <span>Document</span>
                                </button>
                            ) : (String(activeRootNode?.title || '').trim().toLowerCase() === 'all quizes' || String(activeRootNode?.title || '').trim().toLowerCase() === 'all quizzes') ? (
                                <button type="button" className={styles.toolbarBtn} onClick={() => handleOpenQuizModal(activeRootId!, activeRootNode?.title || '')} title="Add Quiz">
                                    <PlusCircle size={15} /> <span>Add Quiz</span>
                                </button>
                            ) : (
                                <>
                                    <button type="button" className={styles.toolbarBtn} onClick={() => handleAddFolderClick(activeRootId!)} title="Create Folder">
                                        <Folder size={15} /> <span>Folder</span>
                                    </button>
                                    <button type="button" className={styles.toolbarBtn} onClick={() => handleAddVideoClick(activeRootId!)} title="Add Video">
                                        <Video size={15} /> <span>Video</span>
                                    </button>
                                    <button type="button" className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId!)} title="Add Document">
                                        <FileText size={15} /> <span>Document</span>
                                    </button>
                                    <button type="button" className={styles.toolbarBtn} onClick={() => handleOpenQuizModal(activeRootId!, activeRootNode?.title || '')} title="Add Quiz">
                                        <ClipboardList size={15} /> <span>Quiz</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>


                    {activeRootNode?.children?.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} className={styles.emptyIcon} />
                            <h3>Folder is Empty</h3>
                            <p>Add subfolders or modules to construct this section.</p>
                        </div>
                    ) : (
                        activeRootNode?.children?.map(node => (
                            <LibraryItem
                                key={node.id}
                                node={node}
                                depth={0}
                                onDelete={handleDeleteClick}
                                onEdit={handleEditClick}
                                onMove={handleMoveItem}
                                siblingIds={activeRootNode!.children!.map(c => c.id)}
                                dragNodeId={dragNodeId}
                                dragOverNodeId={dragOverNodeId}
                                dragOverPosition={dragOverPosition}
                                onDragStart={handleDragStart}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                            />
                        ))
                    )}
                </motion.div>
            )}

            <AnimatePresence>
                {isFolderModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsFolderModalOpen(false)}>
                        <motion.div className={styles.modal} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Create New Folder</h3>
                                <button className={styles.closeBtn} onClick={() => setIsFolderModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitFolder} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Folder Name</label>
                                    <input type="text" value={folderTitle} onChange={e => setFolderTitle(e.target.value)} placeholder="e.g. Basic Medicine, Anatomy..." required autoFocus />
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Folder'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isVideoModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsVideoModalOpen(false)}>
                        <motion.div className={styles.modal} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Add Module to Library</h3>
                                <button className={styles.closeBtn} onClick={() => setIsVideoModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitVideo} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Module Title</label>
                                    <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="e.g. General Embryology" required autoFocus />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.formGroup}>
                                        <label>Video Type</label>
                                        <select value={videoType} onChange={e => { const nextType = e.target.value as ContentType; setVideoType(nextType); setVideoFile(null); setVideoUrl(''); }}>
                                            <option value="youtube">YouTube Embed</option>
                                            <option value="self-hosted">Self-Hosted Video</option>
                                        </select>
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    {videoType === 'youtube' ? (
                                        <>
                                            <label>YouTube URL</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." required />
                                        </>
                                    ) : (
                                        <>
                                            <label>Upload Video File</label>
                                            <div 
                                                className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={e => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    const file = e.dataTransfer.files?.[0];
                                                    if (file) handleFileSelect(file);
                                                }}
                                                onClick={() => document.getElementById('videoFileInput')?.click()}
                                            >
                                                <input id="videoFileInput" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
                                                <UploadCloud size={32} className={styles.dropIcon} />
                                                <p>{videoFile ? videoFile.name : "Drag & Drop video file here, or click to select"}</p>
                                                <small className={styles.fieldHint}>Supported: MP4, WEBM, MOV, MKV (max 1GB)</small>
                                            </div>
                                            
                                            {uploadingVideo && uploadProgress > 0 && (
                                                <div className={styles.progressContainer}>
                                                    <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                                                    <span className={styles.progressText}>{uploadProgress}%</span>
                                                </div>
                                            )}

                                            <label style={{ marginTop: '12px' }}>Or Direct Video URL (Optional)</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." />
                                        </>
                                    )}
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{uploadingVideo ? 'Uploading...' : isSubmitting ? 'Adding...' : 'Add Video'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isDocModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsDocModalOpen(false)}>
                        <motion.div className={styles.modal} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Add Document</h3>
                                <button className={styles.closeBtn} onClick={() => setIsDocModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitVideo} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Document Title</label>
                                    <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} placeholder="e.g. Chapter 1 Notes" required autoFocus />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Add Documents</label>
                                    <div 
                                        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setIsDragging(false);
                                            const files = Array.from(e.dataTransfer.files);
                                            const newAtts = files.map(f => ({ name: f.name, file: f }));
                                            setDocAttachments([...docAttachments, ...newAtts]);
                                        }}
                                        onClick={() => document.getElementById('docFileInput')?.click()}
                                    >
                                        <input id="docFileInput" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed" style={{ display: 'none' }} onChange={e => {
                                            if (e.target.files) {
                                                const files = Array.from(e.target.files);
                                                const newAtts = files.map(f => ({ name: f.name, file: f }));
                                                setDocAttachments([...docAttachments, ...newAtts]);
                                            }
                                        }} />
                                        <UploadCloud size={32} className={styles.dropIcon} />
                                        <p>Drag & Drop documents here, or click to select multiple</p>
                                        <small className={styles.fieldHint}>Supported: PDF, DOC, DOCX, PPT, PPTX, ZIP (max 500MB)</small>
                                    </div>
                                    
                                    {docAttachments.length > 0 && (
                                        <div className={styles.docList}>
                                            {docAttachments.map((att, idx) => (
                                                <div key={idx} className={styles.docItem}>
                                                    <span className={styles.docName} title={att.name}>{att.name}</span>
                                                    <button type="button" onClick={() => setDocAttachments(docAttachments.filter((_, i) => i !== idx))} className={styles.docRemoveBtn} title="Remove document">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {uploadingVideo && uploadProgress > 0 && (
                                        <div className={styles.progressContainer}>
                                            <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                                            <span className={styles.progressText}>{uploadProgress}%</span>
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{uploadingVideo ? 'Uploading...' : isSubmitting ? 'Adding...' : 'Save Document Node'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isEditModalOpen && editingNode && (
                    <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
                        <motion.div className={styles.modal} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3>Edit {editingNode.type === 'folder' ? 'Folder' : 'Module' }</h3>
                                <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitEdit} className={styles.form}>
                                {editingNode.type === 'folder' ? (
                                    <div className={styles.formGroup}>
                                        <label>Folder Name</label>
                                        <input type="text" value={folderTitle} onChange={e => setFolderTitle(e.target.value)} required autoFocus />
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.formGroup}>
                                            <label>Module Title</label>
                                            <input type="text" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} required autoFocus />
                                        </div>
                                        <div className={styles.row}>
                                            <div className={styles.formGroup}>
                                                <label>Module Type</label>
                                                <select value={videoType} onChange={e => setVideoType(e.target.value as ContentType)}>
                                                    <option value="youtube">YouTube Embed</option>
                                                    <option value="self-hosted">Self-Hosted Video</option>
                                                    <option value="document">Document</option>
                                                </select>
                                            </div>
                                        </div>
                                        {videoType !== 'document' && (
                                            <div className={styles.formGroup}>
                                                <label>Resource URL</label>
                                                <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} required={!videoFile} />
                                            </div>
                                        )}
                                        {videoType === 'self-hosted' && (
                                            <div className={styles.formGroup}>
                                                <label>Replace File (Optional)</label>
                                                <div 
                                                    className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={e => {
                                                        e.preventDefault();
                                                        setIsDragging(false);
                                                        const file = e.dataTransfer.files?.[0];
                                                        if (file) handleFileSelect(file);
                                                    }}
                                                    onClick={() => document.getElementById('editFileInput')?.click()}
                                                >
                                                    <input id="editFileInput" type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
                                                    <UploadCloud size={32} className={styles.dropIcon} />
                                                    <p>{videoFile ? videoFile.name : "Drag & Drop new file here to replace, or click"}</p>
                                                    <small className={styles.fieldHint}>Leave empty to keep existing file. Uploading a new file will overwrite the Resource URL.</small>
                                                </div>

                                                {uploadingVideo && uploadProgress > 0 && (
                                                    <div className={styles.progressContainer}>
                                                        <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                                                        <span className={styles.progressText}>{uploadProgress}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {videoType === 'document' && (
                                            <div className={styles.formGroup}>
                                                <label>Manage Documents</label>
                                                <div 
                                                    className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
                                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                                    onDragLeave={() => setIsDragging(false)}
                                                    onDrop={e => {
                                                        e.preventDefault();
                                                        setIsDragging(false);
                                                        const files = Array.from(e.dataTransfer.files);
                                                        const newAtts = files.map(f => ({ name: f.name, file: f }));
                                                        setDocAttachments([...docAttachments, ...newAtts]);
                                                    }}
                                                    onClick={() => document.getElementById('editDocFileInput')?.click()}
                                                >
                                                    <input id="editDocFileInput" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed" style={{ display: 'none' }} onChange={e => {
                                                        if (e.target.files) {
                                                            const files = Array.from(e.target.files);
                                                            const newAtts = files.map(f => ({ name: f.name, file: f }));
                                                            setDocAttachments([...docAttachments, ...newAtts]);
                                                        }
                                                    }} />
                                                    <UploadCloud size={32} className={styles.dropIcon} />
                                                    <p>Drag & Drop documents here, or click to select multiple</p>
                                                </div>

                                                {docAttachments.length > 0 && (
                                                    <div className={styles.docList}>
                                                        {docAttachments.map((att, idx) => (
                                                            <div key={idx} className={styles.docItem}>
                                                                <span className={styles.docName} title={att.name}>{att.name}</span>
                                                                <button type="button" onClick={() => setDocAttachments(docAttachments.filter((_, i) => i !== idx))} className={styles.docRemoveBtn} title="Remove document">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {uploadingVideo && uploadProgress > 0 && (
                                                    <div className={styles.progressContainer}>
                                                        <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                                                        <span className={styles.progressText}>{uploadProgress}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Save Changes'}</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Quiz Selector Modal */}
            <AnimatePresence>
                {isQuizModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsQuizModalOpen(false)}>
                        <motion.div className={`${styles.modal} ${styles.quizModal}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={e => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Add Quizzes to {quizModalTargetTitle}</h3>
                                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        Select from your published quizzes to attach to this folder.
                                    </p>
                                </div>
                                <button className={styles.closeBtn} onClick={() => setIsQuizModalOpen(false)}><X size={20} /></button>
                            </div>

                            <div className={styles.quizModalBody}>
                                <div className={styles.quizModalSearch}>
                                    <Search size={16} className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        placeholder="Search quizzes by title..."
                                        value={quizSearch}
                                        onChange={(e) => setQuizSearch(e.target.value)}
                                        className={styles.quizSearchInput}
                                        autoFocus
                                    />
                                </div>

                                <div className={styles.quizListContainer}>
                                    {loadingQuizzes ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                            <Loader variant="inline" text="Loading quizzes..." />
                                        </div>
                                    ) : filteredQuizzes.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                            {availableQuizzes.length === 0 ? (
                                                <>
                                                    <p style={{ fontWeight: 600, marginBottom: '6px' }}>No Published Quizzes Found</p>
                                                    <p style={{ fontSize: '13px' }}>Create and publish quizzes in the Quizzes section first.</p>
                                                </>
                                            ) : (
                                                <p>No quizzes matching &quot;{quizSearch}&quot;</p>
                                            )}
                                        </div>
                                    ) : (
                                        filteredQuizzes.map((quiz: any) => {
                                            const isSelected = selectedQuizIds.includes(quiz.id);
                                            const isAlreadyInFolder = activeRootNode?.children?.some((c: any) => c.type === 'quiz' && (c.url === quiz.id || c.quizId === quiz.id));

                                            return (
                                                <div
                                                    key={quiz.id}
                                                    className={`${styles.quizOptionRow} ${isSelected ? styles.quizOptionRowSelected : ''}`}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedQuizIds(selectedQuizIds.filter(id => id !== quiz.id));
                                                        } else {
                                                            setSelectedQuizIds([...selectedQuizIds, quiz.id]);
                                                        }
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => {}}
                                                        className={styles.quizCheckbox}
                                                    />
                                                    <div className={styles.quizOptionInfo}>
                                                        <div className={styles.quizOptionTitle}>
                                                            {quiz.title}
                                                            {isAlreadyInFolder && (
                                                                <span className={styles.alreadyAddedBadge}>In Folder</span>
                                                            )}
                                                        </div>
                                                        <div className={styles.quizOptionMeta}>
                                                            {quiz.numQuestionsToServe || quiz.questionsCount || 0} Questions • {quiz.durationMinutes || 0} mins
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className={styles.quizModalFooter}>
                                <span className={styles.quizSelectedCount}>
                                    {selectedQuizIds.length} quiz{selectedQuizIds.length !== 1 ? 'zes' : ''} selected
                                </span>
                                <div className={styles.quizModalActions}>
                                    <button
                                        type="button"
                                        className={styles.cancelBtn}
                                        onClick={() => setIsQuizModalOpen(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.submitBtn}
                                        disabled={selectedQuizIds.length === 0 || savingQuizzes}
                                        onClick={handleSubmitQuizzes}
                                    >
                                        {savingQuizzes ? 'Adding...' : `Add Selected (${selectedQuizIds.length})`}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Quiz / Replace Modal */}
            <AnimatePresence>
                {isEditQuizModalOpen && quizEditNode && (() => {
                    const currentQuizId = quizEditNode.url || quizEditNode.quizId || '';
                    const foundQuiz = availableQuizzes.find(q => q.id === currentQuizId);
                    const isMissing = !loadingQuizzes && !foundQuiz;
                    const hasSelectedNew = selectedReplacementQuizId && selectedReplacementQuizId !== currentQuizId;

                    return (
                        <div className={styles.modalOverlay} onClick={() => setIsEditQuizModalOpen(false)}>
                            <motion.div 
                                className={`${styles.modal} ${styles.editQuizModal}`} 
                                initial={{ opacity: 0, y: 20 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, y: 20 }} 
                                onClick={e => e.stopPropagation()}
                            >
                                <div className={styles.modalHeader}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <ClipboardList size={20} style={{ color: '#8b5cf6' }} /> Manage Quiz Item
                                        </h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                                            Review details, edit quiz content in the builder, or swap with another quiz.
                                        </p>
                                    </div>
                                    <button className={styles.closeBtn} onClick={() => setIsEditQuizModalOpen(false)}><X size={20} /></button>
                                </div>

                                <div className={styles.editQuizModalBody}>
                                    {/* Current Quiz Card */}
                                    <div className={styles.currentQuizCard}>
                                        <div className={styles.currentQuizTop}>
                                            <div className={styles.currentQuizIcon}>
                                                <ClipboardList size={22} />
                                            </div>
                                            <div className={styles.currentQuizInfo}>
                                                <div className={styles.currentQuizTitleRow}>
                                                    <h4 className={styles.currentQuizTitle}>{foundQuiz?.title || quizEditNode.title}</h4>
                                                    {isMissing ? (
                                                        <span className={styles.missingBadge}>
                                                            <AlertCircle size={13} /> Quiz Not Found in DB
                                                        </span>
                                                    ) : (
                                                        <span className={`${styles.statusBadge} ${foundQuiz?.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                                                            {foundQuiz?.status === 'published' ? 'Published' : 'Draft'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.currentQuizMeta}>
                                                    <span>Duration: {foundQuiz?.durationMinutes ? `${foundQuiz.durationMinutes} min` : quizEditNode.duration || 'Standard'}</span>
                                                    {foundQuiz?.questions?.length !== undefined && (
                                                        <span>• {foundQuiz.questions.length} questions</span>
                                                    )}
                                                    {currentQuizId && (
                                                        <span className={styles.quizIdTag}>ID: {currentQuizId.slice(0, 12)}...</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isMissing ? (
                                            <div className={styles.quizMissingAlert}>
                                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <span>
                                                    This quiz record was deleted or does not exist in the database. Choose an active quiz below to replace it, or remove this node from the folder.
                                                </span>
                                            </div>
                                        ) : (
                                            <div className={styles.currentQuizActions}>
                                                <button
                                                    type="button"
                                                    className={styles.extEditBtn}
                                                    onClick={() => window.open(`/teacher/dashboard/quizzes/${currentQuizId}/edit`, '_blank')}
                                                >
                                                    <ExternalLink size={15} />
                                                    <span>Open in Quiz Builder & Edit Questions</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Replace Quiz Section */}
                                    <div className={styles.replaceSection}>
                                        <div className={styles.replaceHeader}>
                                            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                                                {isMissing ? 'Select Replacement Quiz' : 'Replace with Another Quiz'}
                                            </h4>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {filteredReplacementQuizzes.length} available
                                            </span>
                                        </div>

                                        <div className={styles.quizModalSearch}>
                                            <Search size={16} className={styles.searchIcon} />
                                            <input
                                                type="text"
                                                placeholder="Search quizzes to assign..."
                                                value={replacementSearch}
                                                onChange={e => setReplacementSearch(e.target.value)}
                                            />
                                        </div>

                                        <div className={styles.quizOptionsList} style={{ maxHeight: '220px' }}>
                                            {loadingQuizzes ? (
                                                <div className={styles.loadingContainer}>
                                                    <Loader />
                                                    <span>Loading available quizzes...</span>
                                                </div>
                                            ) : filteredReplacementQuizzes.length === 0 ? (
                                                <div className={styles.emptyQuizSearch}>
                                                    <span>No matching quizzes found.</span>
                                                </div>
                                            ) : (
                                                filteredReplacementQuizzes.map((quiz: any) => {
                                                    const isCurrent = quiz.id === currentQuizId;
                                                    const isSelected = selectedReplacementQuizId === quiz.id;

                                                    return (
                                                        <div
                                                            key={quiz.id}
                                                            className={`${styles.quizRadioOption} ${isSelected ? styles.quizOptionSelected : ''} ${isCurrent ? styles.quizOptionCurrent : ''}`}
                                                            onClick={() => setSelectedReplacementQuizId(quiz.id)}
                                                        >
                                                            <div className={styles.radioCircle}>
                                                                {isSelected && <div className={styles.radioInner} />}
                                                            </div>
                                                            <div className={styles.quizOptionInfo}>
                                                                <div className={styles.quizOptionTitle}>
                                                                    <span>{quiz.title}</span>
                                                                    {isCurrent && (
                                                                        <span className={styles.currentBadge}>Current</span>
                                                                    )}
                                                                </div>
                                                                <div className={styles.quizOptionMeta}>
                                                                    {quiz.numQuestionsToServe || quiz.questionsCount || 0} Questions • {quiz.durationMinutes ? `${quiz.durationMinutes} min` : 'Standard'} • {quiz.status === 'published' ? 'Published' : 'Draft'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.editQuizModalFooter}>
                                    <button
                                        type="button"
                                        className={styles.deleteNodeBtn}
                                        onClick={() => {
                                            const idToDelete = quizEditNode.id;
                                            setIsEditQuizModalOpen(false);
                                            setQuizEditNode(null);
                                            handleDeleteClick(idToDelete);
                                        }}
                                    >
                                        <Trash2 size={15} />
                                        <span>Remove Item</span>
                                    </button>

                                    <div className={styles.quizModalActions}>
                                        <button 
                                            type="button"
                                            className={styles.cancelBtn} 
                                            onClick={() => {
                                                setIsEditQuizModalOpen(false);
                                                setQuizEditNode(null);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.primaryBtn}
                                            disabled={!selectedReplacementQuizId || (!hasSelectedNew && !isMissing) || isSavingQuizReplacement}
                                            onClick={handleSaveQuizReplacement}
                                            style={{ padding: '10px 20px', fontSize: '0.9rem' }}
                                        >
                                            {isSavingQuizReplacement ? 'Saving...' : hasSelectedNew || isMissing ? 'Save & Replace' : 'No Changes'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    );
                })()}
            </AnimatePresence>

            {/* Reusable Confirmation Modal */}

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                title={confirmConfig.title}
                message={confirmConfig.message}
                confirmText={confirmConfig.confirmText}
                variant={confirmConfig.variant}
                isSubmitting={confirmConfig.isSubmitting}
                onConfirm={confirmConfig.onConfirm}
                onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Reusable Alert Modal */}
            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}


