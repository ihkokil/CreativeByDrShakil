import { useState, useEffect, useCallback } from "react";
import styles from "./VideoLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, ChevronDown, ChevronRight, X, Loader2, ArrowUp, ArrowDown } from "lucide-react";
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
    onMove: (id: string, direction: 'up' | 'down') => void;
}

const LibraryItem = ({ node, depth, onAddFolder, onAddVideo, onDelete, onMove }: NodeProps) => {
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
                            <PlayCircle size={18} className={styles.playIcon} />
                            <span className={styles.videoTitle}>{node.title}</span>
                            {node.url && <span className={styles.videoSource}>{node.type === 'youtube' ? 'YouTube' : 'Self-Hosted'}</span>}
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
                    <button className={styles.actionBtn} title="Edit">
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
                                onMove={onMove}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function VideoLibraryManager() {
    // Drill-down state
    const [activeRootId, setActiveRootId] = useState<string | null>(null);

    // Data from API
    const [libraryData, setLibraryData] = useState<CurriculumNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const [activeParentId, setActiveParentId] = useState<string | null>(null);

    // Form States
    const [folderTitle, setFolderTitle] = useState("");
    const [videoTitle, setVideoTitle] = useState("");
    const [videoType, setVideoType] = useState<ContentType>('youtube');
    const [videoUrl, setVideoUrl] = useState("");
    const [videoDuration, setVideoDuration] = useState("");

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

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/teacher/video-library', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    title: videoTitle.trim(),
                    type: videoType,
                    url: videoUrl.trim() || null,
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
            setIsVideoModalOpen(false);
            await fetchLibrary();
        } catch (err: any) {
            alert(err.message || 'Failed to add video.');
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
                    <h3>Loading Video Library...</h3>
                    <p>Fetching your organized video content.</p>
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
                    <h2>Master <span className="gradient-text">Video Library</span></h2>
                    <p>Organize all of your self-hosted and YouTube video lectures here. You can construct course curriculums later using this library.</p>
                </div>
                {!activeRootId && (
                    <button className={styles.primaryBtn} onClick={() => handleAddFolderClick()}>
                        <Plus size={18} /> New Root Category
                    </button>
                )}
            </div>

            {!activeRootId ? (
                // Root Categories Card Grid View
                <>
                    {libraryData.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FolderOpen size={48} className={styles.emptyIcon} />
                            <h3>Your Library is Empty</h3>
                            <p>Create a root category to start organizing your videos.</p>
                        </div>
                    ) : (
                        <div className={styles.libraryGrid}>
                            {libraryData.map(node => (
                                <motion.div
                                    key={node.id}
                                    className={styles.rootCard}
                                    onClick={() => setActiveRootId(node.id)}
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
                                            onClick={(e) => e.stopPropagation()}
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
                            <h3>Category is Empty</h3>
                            <p>Add subfolders or videos to construct this section.</p>
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
                                <h3>Create New Category / Folder</h3>
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
                                <h3>Add Video to Library</h3>
                                <button className={styles.closeBtn} onClick={() => setIsVideoModalOpen(false)}><X size={20} /></button>
                            </div>
                            <form onSubmit={submitVideo} className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Video Title</label>
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
                                        <label>Video Source</label>
                                        <select value={videoType} onChange={e => setVideoType(e.target.value as ContentType)}>
                                            <option value="youtube">YouTube Embed</option>
                                            <option value="self-hosted">Self-Hosted / MP4 URL</option>
                                        </select>
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Duration (Optional)</label>
                                        <input
                                            type="text"
                                            value={videoDuration}
                                            onChange={e => setVideoDuration(e.target.value)}
                                            placeholder="e.g. 45:00"
                                        />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Video URL</label>
                                    <input
                                        type="url"
                                        value={videoUrl}
                                        onChange={e => setVideoUrl(e.target.value)}
                                        placeholder="https://..."
                                        required
                                    />
                                </div>
                                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Video'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
