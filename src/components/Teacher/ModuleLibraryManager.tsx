import { useState, useEffect, useCallback } from "react";
import styles from "./ModuleLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, FileText, ChevronDown, ChevronRight, X, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ContentType = 'youtube' | 'self-hosted' | 'document';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
    children?: CurriculumNode[];
}

interface FlatNode {
    id: string;
    title: string;
    type: string;
    url: string | null;
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
    onAddFolder: (parentId: string) => void;
    onAddVideo: (parentId: string) => void;
    onDelete: (id: string) => void;
    onEdit: (node: CurriculumNode) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
}

const LibraryItem = ({ node, depth, onAddFolder, onAddVideo, onDelete, onEdit, onMove }: NodeProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = node.type === 'folder';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) setIsOpen(!isOpen);
    };

    return (
        <div className={styles.nodeContainer}>
            <div
                className={`${styles.nodeRow} ${isFolder ? styles.folderRow : styles.videoRow}`}
                style={{ paddingLeft: `${depth * 25 + 15}px` }}
                onClick={handleToggle}
            >
                <div className={styles.nodeLabel}>
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
                            {node.type === 'document' && <span className={styles.documentBadge}>Document</span>}
                            {node.url && <span className={styles.videoSource}>{node.type === 'youtube' ? 'YouTube' : (node.type === 'document' ? 'External/Uploaded' : 'Self-Hosted')}</span>}
                            {node.duration && <span className={styles.duration}>{node.duration}</span>}
                        </>
                    )}
                </div>

                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'up')} title="Move Up"><ArrowUp size={14} /></button>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'down')} title="Move Down"><ArrowDown size={14} /></button>
                    {isFolder && (
                        <>
                            <button className={styles.actionBtn} onClick={() => onAddFolder(node.id)} title="Add Subfolder">
                                <Folder size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                            <button className={styles.actionBtn} onClick={() => onAddVideo(node.id)} title="Add Module">
                                <Video size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                        </>
                    )}
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
                                onAddFolder={onAddFolder}
                                onAddVideo={onAddVideo}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onMove={onMove}
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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<CurriculumNode | null>(null);
    const [activeParentId, setActiveParentId] = useState<string | null>(null);

    const [folderTitle, setFolderTitle] = useState("");
    const [videoTitle, setVideoTitle] = useState("");
    const [videoType, setVideoType] = useState<ContentType>('youtube');
    const [videoUrl, setVideoUrl] = useState("");
    const [videoDuration, setVideoDuration] = useState("");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
    const handleAddVideoClick = (parentId: string) => { setActiveParentId(parentId); setIsVideoModalOpen(true); };

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
        setIsEditModalOpen(true);
    };

    const handleRootClick = (node: CurriculumNode) => { setActiveRootId(node.id); setPath([node]); };
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

        if (videoType === 'document' && !videoUrl.trim() && !videoFile) { alert('Please provide a document URL or upload a file.'); return; }

        setIsSubmitting(true);
        try {
            let resolvedVideoUrl = videoUrl.trim() || null;

            if ((videoType === 'self-hosted' || videoType === 'document') && videoFile) {
                setUploadingVideo(true);
                const formData = new FormData();
                formData.append('file', videoFile);
                const uploadHeaders: HeadersInit = {};
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                if (token) uploadHeaders.Authorization = `Bearer ${token}`;

                const uploadRes = await fetch('/api/teacher/uploads', { method: 'POST', headers: uploadHeaders, body: formData });
                if (!uploadRes.ok) {
                    const uploadData = await uploadRes.json().catch(() => ({ error: 'Upload failed.' }));
                    throw new Error(uploadData.error || 'Upload failed.');
                }
                const uploadData = await uploadRes.json();
                resolvedVideoUrl = typeof uploadData.url === 'string' ? uploadData.url : null;
            }

            const res = await fetch('/api/teacher/video-library', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ title: videoTitle.trim(), type: videoType, url: resolvedVideoUrl, duration: videoDuration.trim() || null, parentId: activeParentId }) });
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to add module.'); }

            setVideoTitle(""); setVideoUrl(""); setVideoDuration(""); setVideoFile(null); setIsVideoModalOpen(false); await fetchLibrary();
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
            const body: any = { title: title.trim() };
            if (!isFolder) { body.url = videoUrl.trim() || null; body.duration = videoDuration.trim() || null; body.type = videoType; }

            const res = await fetch(`/api/teacher/video-library/${editingNode.id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify(body) });
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to update.'); }

            setIsEditModalOpen(false); setEditingNode(null); await fetchLibrary();
        } catch (err: any) { alert(err.message || 'Failed to update item.'); } finally { setIsSubmitting(false); }
    };

    const activeRootNode = libraryData.find(root => root.id === activeRootId);

    if (isLoading) {
        return (
            <div className={styles.managerContainer}>
                <div className={styles.emptyState}>
                    <Loader2 size={48} className={styles.emptyIcon} style={{ animation: 'spin 1s linear infinite' }} />
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
                        <button className={styles.backBtn} onClick={() => setActiveRootId(null)}>
                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back to Root Folders
                        </button>
                        <h3 className={styles.activeRootTitle}>{activeRootNode?.title}</h3>
                        <div className={styles.actions}>
                            <button className={styles.actionBtn} onClick={() => handleAddFolderClick(activeRootId)} title="Add Subfolder">
                                <Folder size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                            <button className={styles.actionBtn} onClick={() => handleAddVideoClick(activeRootId)} title="Add Module">
                                <Video size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
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
                            <LibraryItem key={node.id} node={node} depth={0} onAddFolder={handleAddFolderClick} onAddVideo={handleAddVideoClick} onDelete={handleDeleteClick} onEdit={handleEditClick} onMove={handleMoveItem} />
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
                                        <label>Module Type</label>
                                        <select value={videoType} onChange={e => { const nextType = e.target.value as ContentType; setVideoType(nextType); setVideoFile(null); setVideoUrl(''); }}>
                                            <option value="youtube">YouTube Embed</option>
                                            <option value="self-hosted">Self-Hosted Video</option>
                                            <option value="document">Document (PDF/PPT/DOC)</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Duration (Optional)</label>
                                        <input type="text" value={videoDuration} onChange={e => setVideoDuration(e.target.value)} placeholder="e.g. 45:00" />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    {videoType === 'youtube' ? (
                                        <>
                                            <label>YouTube URL</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." required />
                                        </>
                                    ) : videoType === 'document' ? (
                                        <>
                                            <label>Upload Document</label>
                                            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                                            <small className={styles.fieldHint}>Supported: .pdf, .doc, .docx, .ppt, .pptx — or provide an external URL below.</small>
                                            <label style={{ marginTop: '8px' }}>Or Document URL (Drive, CDN)</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://drive.google.com/... or https://..." />
                                        </>
                                    ) : (
                                        <>
                                            <label>Upload Video File</label>
                                            <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                                            <small className={styles.fieldHint}>Supported: MP4, WEBM, MOV, MKV (max 1GB)</small>
                                            <label style={{ marginTop: '8px' }}>Or Direct Video URL (Optional)</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://..." />
                                        </>
                                    )}
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>{uploadingVideo ? 'Uploading...' : isSubmitting ? 'Adding...' : 'Add Module'}</button>
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
                                            <div className={styles.formGroup}>
                                                <label>Duration</label>
                                                <input type="text" value={videoDuration} onChange={e => setVideoDuration(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>Resource URL</label>
                                            <input type="url" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} required />
                                        </div>
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
import { useState, useEffect, useCallback } from "react";
import styles from "./ModuleLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, ChevronDown, ChevronRight, X, Loader2, ArrowUp, ArrowDown, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ContentType = 'youtube' | 'self-hosted' | 'document';

export interface CurriculumNode {
    id: string;
    title: string;
    type: 'folder' | ContentType;
    duration?: string;
    url?: string;
    children?: CurriculumNode[];
}

interface FlatNode {
    id: string;
    title: string;
    type: string;
    url: string | null;
    duration: string | null;
    parentId: string | null;
    sortOrder: number;
}

/** Convert flat DB rows into a nested tree */
function buildTree(flatNodes: FlatNode[]): CurriculumNode[] {
    const map = new Map<string, CurriculumNode>();
    const roots: CurriculumNode[] = [];

    // First pass: create all nodes
    for (const node of flatNodes) {
        map.set(node.id, {
            id: node.id,
            title: node.title,
            type: node.type as CurriculumNode['type'],
            url: node.url || undefined,
            duration: node.duration || undefined,
            children: node.type === 'folder' ? [] : undefined,
        });
    }

    // Second pass: assign children
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
    onAddFolder: (parentId: string) => void;
    onAddVideo: (parentId: string) => void;
    onDelete: (id: string) => void;
    onEdit: (node: CurriculumNode) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
}

const LibraryItem = ({ node, depth, onAddFolder, onAddVideo, onDelete, onEdit, onMove }: NodeProps) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = node.type === 'folder';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) setIsOpen(!isOpen);
    };

    return (
        <div className={styles.nodeContainer}>
            <div
                className={`${styles.nodeRow} ${isFolder ? styles.folderRow : styles.videoRow}`}
                style={{ paddingLeft: `${depth * 25 + 15}px` }}
                onClick={handleToggle}
            >
                <div className={styles.nodeLabel}>
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
                            {node.url && node.type === 'document' && (
                                <span className={styles.documentSource}>
                                    <FileText size={11} />
                                    <span>Document</span>
                                </span>
                            )}
                            {node.url && node.type !== 'document' && (
                                <span className={styles.videoSource}>
                                    {node.type === 'youtube' ? 'YouTube' : 'Self-Hosted'}
                                </span>
                            )}
                            {node.duration && <span className={styles.duration}>{node.duration}</span>}
                        </>
                    )}
                </div>

                <div className={styles.actions} onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'up')} title="Move Up"><ArrowUp size={14} /></button>
                    <button className={styles.actionBtn} onClick={() => onMove(node.id, 'down')} title="Move Down"><ArrowDown size={14} /></button>
                    {isFolder && (
                        <>
                            <button className={styles.actionBtn} onClick={() => onAddFolder(node.id)} title="Add Subfolder">
                                <Folder size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                            <button className={styles.actionBtn} onClick={() => onAddVideo(node.id)} title="Add Video">
                                <Video size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                        </>
                    )}
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
                                onAddFolder={onAddFolder}
                                onAddVideo={onAddVideo}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onMove={onMove}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function ModuleLibraryManager() {
    // Drill-down state
    const [activeRootId, setActiveRootId] = useState<string | null>(null);

    // Data from API
    const [libraryData, setLibraryData] = useState<CurriculumNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Breadcrumb state
    const [path, setPath] = useState<CurriculumNode[]>([]);

    // Modal States
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingNode, setEditingNode] = useState<CurriculumNode | null>(null);
    const [activeParentId, setActiveParentId] = useState<string | null>(null);

    // Form States
    const [folderTitle, setFolderTitle] = useState("");
    const [videoTitle, setVideoTitle] = useState("");
    const [videoType, setVideoType] = useState<ContentType>('youtube');
    const [videoUrl, setVideoUrl] = useState("");
    const [videoDuration, setVideoDuration] = useState("");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploadingVideo, setUploadingVideo] = useState(false);

    // Submitting state
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getAuthHeaders = useCallback((): HeadersInit => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    // Fetch library data from API
    const fetchLibrary = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch('/api/teacher/video-library', {
                headers: getAuthHeaders(),
            });

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

    useEffect(() => {
        fetchLibrary();
    }, [fetchLibrary]);

    const handleAddFolderClick = (parentId?: string) => {
        setActiveParentId(parentId || null);
        setIsFolderModalOpen(true);
    };

    const handleAddVideoClick = (parentId: string) => {
        setActiveParentId(parentId);
        setIsVideoModalOpen(true);
    };

    const handleDeleteClick = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Are you sure you want to delete this item? This will also delete all nested content inside it.")) return;

        try {
            if (id === activeRootId) setActiveRootId(null);

            const res = await fetch(`/api/teacher/video-library/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete.');
            }

            // Refetch to stay in sync
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to delete item.');
        }
    };

    const handleMoveItem = async (id: string, direction: 'up' | 'down') => {
        try {
            const res = await fetch('/api/teacher/video-library/reorder', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ id, direction }),
            });
            if (!res.ok) throw new Error("Failed to reorder.");
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to move item.');
        }
    };

    const handleEditClick = (node: CurriculumNode, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingNode(node);
        setFolderTitle(node.title);
        setVideoTitle(node.title);
        setVideoUrl(node.url || "");
        setVideoDuration(node.duration || "");
        setVideoType(node.type === 'folder' ? 'youtube' : node.type as ContentType);
        setIsEditModalOpen(true);
    };

    const handleRootClick = (node: CurriculumNode) => {
        setActiveRootId(node.id);
        setPath([node]);
    };

    const handleBreadcrumbClick = (index: number) => {
        if (index === -1) {
            setActiveRootId(null);
            setPath([]);
        } else {
            const nextPath = path.slice(0, index + 1);
            setPath(nextPath);
            setActiveRootId(nextPath[nextPath.length - 1].id);
        }
    };

    const submitFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderTitle.trim() || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/teacher/video-library', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: folderTitle.trim(),
                    type: 'folder',
                    parentId: activeParentId || null,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create folder.');
            }

            setFolderTitle("");
            setIsFolderModalOpen(false);
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to create folder.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTitle.trim() || !activeParentId || isSubmitting) return;

        if (videoType === 'youtube' && !videoUrl.trim()) {
            alert('YouTube URL is required.');
            return;
        }

        if ((videoType === 'self-hosted' || videoType === 'document') && !videoUrl.trim() && !videoFile) {
            alert(videoType === 'document' ? 'Please upload a document file or provide a document URL.' : 'Please upload a video file or provide a direct URL.');
            return;
        }

        setIsSubmitting(true);
        try {
            let resolvedVideoUrl = videoUrl.trim() || null;

            if ((videoType === 'self-hosted' || videoType === 'document') && videoFile) {
                setUploadingVideo(true);
                const formData = new FormData();
                formData.append('file', videoFile);

                const uploadHeaders: HeadersInit = {};
                const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
                if (token) {
                    uploadHeaders.Authorization = `Bearer ${token}`;
                }

                const uploadRes = await fetch('/api/teacher/uploads', {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: formData,
                });

                if (!uploadRes.ok) {
                    const uploadData = await uploadRes.json().catch(() => ({ error: 'Video upload failed.' }));
                    throw new Error(uploadData.error || 'Video upload failed.');
                }

                const uploadData = await uploadRes.json();
                resolvedVideoUrl = typeof uploadData.url === 'string' ? uploadData.url : null;
            }

            const res = await fetch('/api/teacher/video-library', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: videoTitle.trim(),
                    type: videoType,
                    url: resolvedVideoUrl,
                    duration: videoDuration.trim() || null,
                    parentId: activeParentId,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to add video.');
            }

            setVideoTitle("");
            setVideoUrl("");
            setVideoDuration("");
            setVideoFile(null);
            setIsVideoModalOpen(false);
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to add video.');
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
            const body: any = { title: title.trim() };
            if (!isFolder) {
                body.url = videoUrl.trim() || null;
                body.duration = videoDuration.trim() || null;
                body.type = videoType;
            }

            const res = await fetch(`/api/teacher/video-library/${editingNode.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update.');
            }

            setIsEditModalOpen(false);
            setEditingNode(null);
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to update item.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeRootNode = libraryData.find(root => root.id === activeRootId);

    // Loading state
    if (isLoading) {
        return (
            <div className={styles.managerContainer}>
                <div className={styles.emptyState}>
                    <Loader2 size={48} className={styles.emptyIcon} style={{ animation: 'spin 1s linear infinite' }} />
                    <h3>Loading Module Library...</h3>
                    <p>Fetching your organized module content.</p>
                </div>
            </div>
        );
    }

    // Error state
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
                    <p>Organize videos and documents here. You can use URL links or local uploads for module files, then construct course curriculums later from this library.</p>
                </div>
                {!activeRootId && (
                    <button className={styles.primaryBtn} onClick={() => handleAddFolderClick()}>
                        <Plus size={18} /> New Root Folder
                    </button>
                )}
            </div>

            {!activeRootId ? (
                // Root Folders Card Grid View
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
            ) : (
                // Active Nested Tree View
                <motion.div
                    className={styles.treeContainer}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                >
                    <div className={styles.breadcrumbBar}>
                        <button className={styles.breadcrumbLink} onClick={() => handleBreadcrumbClick(-1)}>
                            Library
                        </button>
                        {path.map((node, i) => (
                            <span key={node.id}>
                                <ChevronRight size={14} className={styles.breadcrumbSep} />
                                <button
                                    className={`${styles.breadcrumbLink} ${i === path.length - 1 ? styles.active : ''}`}
                                    onClick={() => handleBreadcrumbClick(i)}
                                >
                                    {node.title}
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className={styles.activeViewHeader}>
                        <button className={styles.backBtn} onClick={() => setActiveRootId(null)}>
                            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back to Root Folders
                        </button>
                        <h3 className={styles.activeRootTitle}>{activeRootNode?.title}</h3>
                        <div className={styles.actions}>
                            <button className={styles.actionBtn} onClick={() => handleAddFolderClick(activeRootId)} title="Add Subfolder">
                                <Folder size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
                            </button>
                            <button className={styles.actionBtn} onClick={() => handleAddVideoClick(activeRootId)} title="Add Video">
                                <Video size={14} /> <Plus size={10} style={{ marginLeft: '-4px', marginBottom: '-4px' }} />
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
                                onAddFolder={handleAddFolderClick}
                                onAddVideo={handleAddVideoClick}
                                onDelete={handleDeleteClick}
                                onEdit={handleEditClick}
                                onMove={handleMoveItem}
                            />
                        ))
                    )}
                </motion.div>
            )}

            {/* Folder Modal */}
            <AnimatePresence>
                {isFolderModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsFolderModalOpen(false)}>
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.modalHeader}>
                                <h3>Create New Folder</h3>
                                <button className={styles.closeBtn} onClick={() => setIsFolderModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitFolder} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Folder Name</label>
                                    <input
                                        type="text"
                                        value={folderTitle}
                                        onChange={e => setFolderTitle(e.target.value)}
                                        placeholder="e.g. Basic Medicine, Anatomy..."
                                        required autoFocus
                                    />
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Creating...' : 'Create Folder'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Video Modal */}
            <AnimatePresence>
                {isVideoModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsVideoModalOpen(false)}>
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.modalHeader}>
                                <h3>Add Module to Library</h3>
                                <button className={styles.closeBtn} onClick={() => setIsVideoModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitVideo} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Module Title</label>
                                    <input
                                        type="text"
                                        value={videoTitle}
                                        onChange={e => setVideoTitle(e.target.value)}
                                        placeholder="e.g. General Embryology"
                                        required autoFocus
                                    />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.formGroup}>
                                        <label>Module Type</label>
                                        <select
                                            value={videoType}
                                            onChange={e => {
                                                const nextType = e.target.value as ContentType;
                                                setVideoType(nextType);
                                                setVideoFile(null);
                                                setVideoUrl('');
                                            }}
                                        >
                                            <option value="youtube">YouTube Video</option>
                                            <option value="self-hosted">Local Video Upload / Direct URL</option>
                                            <option value="document">Document URL / Local Upload</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>{videoType === 'document' ? 'Notes (Optional)' : 'Duration (Optional)'}</label>
                                        <input
                                            type="text"
                                            value={videoDuration}
                                            onChange={e => setVideoDuration(e.target.value)}
                                            placeholder={videoType === 'document' ? 'Optional short note' : 'e.g. 45:00'}
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    {videoType === 'youtube' ? (
                                        <>
                                            <label>YouTube URL</label>
                                            <input
                                                type="url"
                                                value={videoUrl}
                                                onChange={e => setVideoUrl(e.target.value)}
                                                placeholder="https://youtube.com/watch?v=..."
                                                required
                                            />
                                        </>
                                    ) : videoType === 'self-hosted' ? (
                                        <>
                                            <label>Upload Video File</label>
                                            <input
                                                type="file"
                                                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                                                onChange={e => setVideoFile(e.target.files?.[0] || null)}
                                            />
                                            <small className={styles.fieldHint}>Supported: MP4, WEBM, MOV, MKV (max 1GB)</small>
                                            <label style={{ marginTop: '8px' }}>Or Direct Video URL (Optional)</label>
                                            <input
                                                type="url"
                                                value={videoUrl}
                                                onChange={e => setVideoUrl(e.target.value)}
                                                placeholder="https://..."
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <label>Document URL or Upload File</label>
                                            <input
                                                type="file"
                                                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx,application/vnd.ms-powerpoint,.ppt,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                                                onChange={e => setVideoFile(e.target.files?.[0] || null)}
                                            />
                                            <small className={styles.fieldHint}>Supported: PDF, PPT, PPTX, DOC, DOCX (max 1GB)</small>
                                            <label style={{ marginTop: '8px' }}>Or Document URL (Google Drive, Dropbox, etc.)</label>
                                            <input
                                                type="url"
                                                value={videoUrl}
                                                onChange={e => setVideoUrl(e.target.value)}
                                                placeholder="https://drive.google.com/..."
                                            />
                                        </>
                                    )}
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {uploadingVideo ? 'Uploading file...' : isSubmitting ? 'Adding...' : 'Add Module'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && editingNode && (
                    <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
                        <motion.div
                            className={styles.modal}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className={styles.modalHeader}>
                                <h3>Edit {editingNode.type === 'folder' ? 'Folder' : editingNode.type === 'document' ? 'Document' : 'Video' }</h3>
                                <button className={styles.closeBtn} onClick={() => setIsEditModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitEdit} className={styles.form}>
                                {editingNode.type === 'folder' ? (
                                    <div className={styles.formGroup}>
                                        <label>Folder Name</label>
                                        <input
                                            type="text"
                                            value={folderTitle}
                                            onChange={e => setFolderTitle(e.target.value)}
                                            required autoFocus
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className={styles.formGroup}>
                                            <label>Module Title</label>
                                            <input
                                                type="text"
                                                value={videoTitle}
                                                onChange={e => setVideoTitle(e.target.value)}
                                                required autoFocus
                                            />
                                        </div>
                                        <div className={styles.row}>
                                            <div className={styles.formGroup}>
                                                <label>Module Type</label>
                                                <select
                                                    value={videoType}
                                                    onChange={e => setVideoType(e.target.value as ContentType)}
                                                >
                                                    <option value="youtube">YouTube Video</option>
                                                    <option value="self-hosted">Local Video Upload / Direct URL</option>
                                                    <option value="document">Document URL / Local Upload</option>
                                                </select>
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>{videoType === 'document' ? 'Notes' : 'Duration'}</label>
                                                <input
                                                    type="text"
                                                    value={videoDuration}
                                                    onChange={e => setVideoDuration(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className={styles.formGroup}>
                                            <label>{videoType === 'document' ? 'Document URL' : 'Video URL'}</label>
                                            <input
                                                type="url"
                                                value={videoUrl}
                                                onChange={e => setVideoUrl(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </>
                                )}
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Updating...' : 'Save Changes'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
