import { useState } from "react";
import styles from "./VideoLibraryManager.module.css";
import { Folder, FolderOpen, PlayCircle, Plus, Edit2, Trash2, Video, ChevronDown, ChevronRight, X } from "lucide-react";
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

interface NodeProps {
    node: CurriculumNode;
    depth: number;
    onAddFolder: (parentId: string) => void;
    onAddVideo: (parentId: string) => void;
    onDelete: (id: string) => void;
}

const LibraryItem = ({ node, depth, onAddFolder, onAddVideo, onDelete }: NodeProps) => {
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
                    {node.id !== 'root' && (
                        <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onDelete(node.id)} title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
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
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function VideoLibraryManager() {
    // Initial mock state acting as our Master Video Library root
    const [libraryData, setLibraryData] = useState<CurriculumNode[]>([
        {
            id: 'root-medicine',
            title: 'Medicine Library',
            type: 'folder',
            children: [
                {
                    id: 'medicine-blood',
                    title: 'Blood',
                    type: 'folder',
                    children: [
                        {
                            id: 'blood-rbc',
                            title: 'RBC',
                            type: 'folder',
                            children: []
                        }
                    ]
                }
            ]
        }
    ]);

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

    // Recursive function to add a node to a specific parent
    const addNodeToParent = (nodes: CurriculumNode[], parentId: string, newNode: CurriculumNode): CurriculumNode[] => {
        return nodes.map(node => {
            if (node.id === parentId) {
                return {
                    ...node,
                    children: [...(node.children || []), newNode]
                };
            }
            if (node.children) {
                return {
                    ...node,
                    children: addNodeToParent(node.children, parentId, newNode)
                };
            }
            return node;
        });
    };

    // Recursive function to delete a node by ID
    const deleteNode = (nodes: CurriculumNode[], idToRemove: string): CurriculumNode[] => {
        return nodes.filter(node => node.id !== idToRemove).map(node => {
            if (node.children) {
                return { ...node, children: deleteNode(node.children, idToRemove) };
            }
            return node;
        });
    };

    const handleAddFolderClick = (parentId?: string) => {
        setActiveParentId(parentId || null);
        setIsFolderModalOpen(true);
    };

    const handleAddVideoClick = (parentId: string) => {
        setActiveParentId(parentId);
        setIsVideoModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        if (confirm("Are you sure you want to delete this item? This will also delete all nested content inside it.")) {
            setLibraryData(prev => deleteNode(prev, id));
        }
    };

    const submitFolder = (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderTitle.trim()) return;

        const newFolder: CurriculumNode = {
            id: `folder-${Date.now()}`,
            title: folderTitle,
            type: 'folder',
            children: []
        };

        if (activeParentId) {
            setLibraryData(prev => addNodeToParent(prev, activeParentId, newFolder));
        } else {
            setLibraryData(prev => [...prev, newFolder]);
        }

        setFolderTitle("");
        setIsFolderModalOpen(false);
    };

    const submitVideo = (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTitle.trim() || !activeParentId) return;

        const newVideo: CurriculumNode = {
            id: `video-${Date.now()}`,
            title: videoTitle,
            type: videoType,
            url: videoUrl,
            duration: videoDuration
        };

        setLibraryData(prev => addNodeToParent(prev, activeParentId, newVideo));

        setVideoTitle("");
        setVideoUrl("");
        setVideoDuration("");
        setIsVideoModalOpen(false);
    };

    return (
        <div className={styles.managerContainer}>
            <div className={styles.header}>
                <div>
                    <h2>Master <span className="gradient-text">Video Library</span></h2>
                    <p>Organize all of your self-hosted and YouTube video lectures here. You can construct course curriculums later using this library.</p>
                </div>
                <button className={styles.primaryBtn} onClick={() => handleAddFolderClick()}>
                    <Plus size={18} /> New Root Category
                </button>
            </div>

            <div className={styles.treeContainer}>
                {libraryData.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FolderOpen size={48} className={styles.emptyIcon} />
                        <h3>Your Library is Empty</h3>
                        <p>Create a root category to start organizing your videos.</p>
                    </div>
                ) : (
                    libraryData.map(node => (
                        <LibraryItem
                            key={node.id}
                            node={node}
                            depth={0}
                            onAddFolder={handleAddFolderClick}
                            onAddVideo={handleAddVideoClick}
                            onDelete={handleDeleteClick}
                        />
                    ))
                )}
            </div>

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
                                <button type="submit" className={styles.submitBtn}>Create Folder</button>
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
                                <button type="submit" className={styles.submitBtn}>Add Video</button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
