import { useState, useEffect, useCallback } from "react";
import Loader from "@/components/UI/Loader";
import styles from "./ModuleLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, FileText, ChevronDown, ChevronRight, X, ArrowUp, ArrowDown, GripVertical, Upload, Link as LinkIcon, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ContentType = 'youtube' | 'self-hosted' | 'document';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
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
                        onDragStart={(e) => { e.stopPropagation(); onDragStart(node.id); }}
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
                        </>
                    ) : (
                        <>
                            {node.type === 'document' ? (
                                <FileText size={18} className={styles.playIcon} />
                            ) : (
                                <PlayCircle size={18} className={styles.playIcon} />
                            )}
                            <span className={styles.videoTitle}>{node.title}</span>
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
            if (!res.ok) throw new Error("Failed to reorder.");
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to move item.');
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

    const formatDuration = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const uploadFileWithProgress = (file: File, token: string | null): Promise<any> => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/teacher/uploads');
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setUploadProgress(percent);
                }
            };
            
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('Invalid response')); }
                } else {
                    try { const res = JSON.parse(xhr.responseText); resolve(res); } catch { reject(new Error('Upload failed')); }
                }
            };
            
            xhr.onerror = () => reject(new Error('Network error during upload'));
            
            const formData = new FormData();
            formData.append('file', file);
            xhr.send(formData);
        });
    };

    const handleDeleteClick = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Are you sure you want to delete this item? This will also delete all nested content inside it.")) return;
        try {
            if (id === activeRootId) setActiveRootId(null);
            const res = await fetch(`/api/teacher/video-library/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete.');
            }
            await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to delete item.'); }
    };

    const handleMoveItem = async (id: string, direction: 'up' | 'down') => {
        try {
            const res = await fetch('/api/teacher/video-library/reorder', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ id, direction }) });
            if (!res.ok) throw new Error("Failed to reorder.");
            await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to move item.'); }
    };

    const handleEditClick = (node: CurriculumNode, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
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
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to create folder.'); }
            setFolderTitle(""); setIsFolderModalOpen(false); await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to create folder.'); } finally { setIsSubmitting(false); }
    };

    const submitVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTitle.trim() || !activeParentId || isSubmitting) return;

        if (videoType === 'youtube' && !videoUrl.trim()) { alert('YouTube URL is required.'); return; }
        if (videoType === 'self-hosted' && !videoUrl.trim() && !videoFile) { alert('Please upload a video file or provide a direct URL.'); return; }
        if (videoType === 'document' && docAttachments.length === 0) { alert('Please add at least one document attachment.'); return; }

        setIsSubmitting(true);
        try {
            let resolvedVideoUrl = videoUrl.trim() || null;
            let finalAttachments = videoType === 'document' ? [...docAttachments] : undefined;

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
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to add module.'); }

            setVideoTitle(""); setVideoUrl(""); setVideoDuration(""); setVideoFile(null); setDocAttachments([]); setIsVideoModalOpen(false); setIsDocModalOpen(false); await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to add module.'); } finally { setUploadingVideo(false); setIsSubmitting(false); }
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
            let finalAttachments = videoType === 'document' ? [...docAttachments] : undefined;

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
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to update.'); }

            setIsEditModalOpen(false); setEditingNode(null); await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to update item.'); } finally { setUploadingVideo(false); setIsSubmitting(false); }
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
            <div className={styles.header}>
                <div>
                    <h2>Master <span className="gradient-text">Module Library</span></h2>
                    <p>Organize your videos and documents (PDF/PPT/DOC). Add via Drive link or upload to the library.</p>
                </div>
                {!activeRootId && (
                    <button className={styles.primaryBtn} onClick={() => handleAddFolderClick()}>
                        <Plus size={18} /> New Root Folder
                    </button>
                )}
            </div>

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
                            <button className={styles.toolbarBtn} onClick={() => handleAddFolderClick(activeRootId)} title="Create Folder">
                                <Folder size={16} /> Folder
                            </button>

                            <button className={styles.toolbarBtn} onClick={() => handleAddVideoClick(activeRootId)} title="Add Video">
                                <Video size={16} /> Video
                            </button>

                            <button className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId)} title="Add Document">
                                <FileText size={16} /> Document
                            </button>
                        </div>
                    </div>

                    {(!activeRootNode?.children || activeRootNode.children.length === 0) ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} className={styles.emptyIcon} />
                            <h3>Folder is Empty</h3>
                            <p>Add subfolders or modules to construct this section.</p>
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

                                    <div className={styles.rootIconWrapper}>
                                        {node.type === 'folder' ? <FolderOpen size={28} /> : (node.type === 'document' ? <FileText size={28} /> : <PlayCircle size={28} />)}
                                    </div>
                                    <div>
                                        <h3 className={styles.rootTitle}>{node.title}</h3>
                                        <span className={styles.rootMeta}>{node.type === 'folder' ? `${node.children?.length || 0} items inside` : (node.duration ? `Duration: ${node.duration}` : 'Document')}</span>
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
                            <button className={styles.toolbarBtn} onClick={() => handleAddFolderClick(activeRootId)} title="Create Folder">
                                <Folder size={16} /> Folder
                            </button>

                            <button className={styles.toolbarBtn} onClick={() => handleAddVideoClick(activeRootId)} title="Add Video">
                                <Video size={16} /> Video
                            </button>

                            <button className={styles.toolbarBtn} onClick={() => handleAddDocClick(activeRootId)} title="Add Document">
                                <FileText size={16} /> Document
                            </button>
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
                                        <input id="docFileInput" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: 'none' }} onChange={e => {
                                            if (e.target.files) {
                                                const files = Array.from(e.target.files);
                                                const newAtts = files.map(f => ({ name: f.name, file: f }));
                                                setDocAttachments([...docAttachments, ...newAtts]);
                                            }
                                        }} />
                                        <UploadCloud size={32} className={styles.dropIcon} />
                                        <p>Drag & Drop documents here, or click to select multiple</p>
                                        <small className={styles.fieldHint}>Supported: PDF, DOC, DOCX, PPT, PPTX</small>
                                    </div>
                                    
                                    {docAttachments.length > 0 && (
                                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {docAttachments.map((att, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                    <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                                    <button type="button" onClick={() => setDocAttachments(docAttachments.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
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
                                                    <input id="editDocFileInput" type="file" multiple accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{ display: 'none' }} onChange={e => {
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
                                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {docAttachments.map((att, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--surface-color)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                                                <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                                                <button type="button" onClick={() => setDocAttachments(docAttachments.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
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
        </div>
    );
}

