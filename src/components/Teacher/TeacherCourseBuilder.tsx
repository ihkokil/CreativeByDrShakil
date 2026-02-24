"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
    BuilderCurriculumNode,
    CourseReleaseModeValue,
    collectVideoNodes,
} from "@/lib/teacher-course-builder";
import { CategorySummary, fetchCategories } from "@/lib/categories";
import styles from "./TeacherCourseBuilder.module.css";
import { FolderPlus, Plus, Save, Trash2, UploadCloud, BookOpen, Calendar, Layers, FolderOpen, Video, Loader2 } from "lucide-react";
import { formatDisplayDate } from "@/lib/date-format";

interface TeacherCourseSummary {
    id: string;
    slug: string | null;
    title: string;
    category: string | null;
    description: string;
    price: number;
    duration: string;
    status: "draft" | "scheduled" | "published" | "archived";
    releaseMode: CourseReleaseModeValue | null;
    releaseStartAt: string | null;
    releaseIntervalDays: number | null;
    releaseGroupsPerWeek: number | null;
    timezone: string;
}

interface TopicSummary {
    id: string;
    title: string;
    subTopicCount: number;
    videoCount: number;
}

interface ReleaseGroupSummary {
    id: string;
    title: string;
    mainTopicTitle: string;
    nodeId: string;
    index: number;
}

const toLocalInputDateTime = (isoDate?: string | null) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const toIsoString = (localDateTime: string) => {
    if (!localDateTime) return null;
    const parsed = new Date(localDateTime);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
};

const flattenFolderOptions = (nodes: BuilderCurriculumNode[]) => {
    const options: Array<{ id: string; label: string }> = [];
    const walk = (list: BuilderCurriculumNode[], trail: string[]) => {
        list.forEach((node) => {
            const nextTrail = [...trail, node.title];
            if (node.type === "folder") {
                options.push({ id: node.id, label: nextTrail.join(" › ") });
            }
            if (node.children?.length) {
                walk(node.children, nextTrail);
            }
        });
    };
    walk(nodes, []);
    return options;
};

/* ─── Curriculum Node Row ─── */
const NodeRow = ({
    node,
    depth,
    overrideDrafts,
    onOverrideChange,
    onSaveOverride,
    onDelete,
}: {
    node: BuilderCurriculumNode;
    depth: number;
    overrideDrafts: Record<string, string>;
    onOverrideChange: (nodeId: string, value: string) => void;
    onSaveOverride: (nodeId: string) => void;
    onDelete: (nodeId: string) => void;
}) => {
    const isFolder = node.type === "folder";

    return (
        <div className={styles.nodeWrap}>
            <div className={styles.nodeRow} style={{ paddingLeft: `${depth * 20 + 16}px` }}>
                <div className={styles.nodeMeta}>
                    {isFolder ? <FolderOpen size={16} style={{ color: "#f59e0b", flexShrink: 0 }} /> : <Video size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                    <strong>{node.title}</strong>
                    <span>{node.type}</span>
                    {node.releaseGroupId && <span className={styles.groupTag}>Group</span>}
                </div>

                <div className={styles.nodeActions}>
                    <input
                        type="datetime-local"
                        value={overrideDrafts[node.id] || ""}
                        onChange={(e) => onOverrideChange(node.id, e.target.value)}
                        title="Manual release date override"
                    />
                    <button className={styles.ghostBtn} onClick={() => onSaveOverride(node.id)}>
                        <Save size={13} /> Save
                    </button>
                    <button className={styles.dangerBtn} onClick={() => onDelete(node.id)} title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {(node.children || []).map((child) => (
                <NodeRow
                    key={child.id}
                    node={child}
                    depth={depth + 1}
                    overrideDrafts={overrideDrafts}
                    onOverrideChange={onOverrideChange}
                    onSaveOverride={onSaveOverride}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
};

/* ─── Main Builder ─── */
export default function TeacherCourseBuilder() {
    const [courses, setCourses] = useState<TeacherCourseSummary[]>([]);
    const [categories, setCategories] = useState<CategorySummary[]>([]);
    const [topics, setTopics] = useState<TopicSummary[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>("");
    const [curriculum, setCurriculum] = useState<BuilderCurriculumNode[]>([]);
    const [groups, setGroups] = useState<ReleaseGroupSummary[]>([]);
    const [computedGroupDates, setComputedGroupDates] = useState<Record<string, string>>({});

    const [groupDateDrafts, setGroupDateDrafts] = useState<Record<string, string>>({});
    const [nodeOverrideDrafts, setNodeOverrideDrafts] = useState<Record<string, string>>({});

    const [releaseMode, setReleaseMode] = useState<CourseReleaseModeValue>("fixed_interval");
    const [releaseStartAt, setReleaseStartAt] = useState("");
    const [intervalDays, setIntervalDays] = useState("7");
    const [groupsPerWeek, setGroupsPerWeek] = useState("2");
    const [courseStatus, setCourseStatus] = useState<"draft" | "scheduled" | "published" | "archived">("draft");

    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

    const [newCourseTitle, setNewCourseTitle] = useState("");
    const [newCourseCategoryId, setNewCourseCategoryId] = useState("");
    const [newCoursePrice, setNewCoursePrice] = useState("0");
    const [newCourseDuration, setNewCourseDuration] = useState("3 Months");
    const [newCourseDescription, setNewCourseDescription] = useState("");

    const [targetParentId, setTargetParentId] = useState("root");
    const [newNodeType, setNewNodeType] = useState<"folder" | "youtube" | "self-hosted" | "document">("folder");
    const [newNodeTitle, setNewNodeTitle] = useState("");
    const [newNodeUrl, setNewNodeUrl] = useState("");
    const [newNodeDuration, setNewNodeDuration] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    const [copySourceNodeId, setCopySourceNodeId] = useState("");
    const [copyTargetParentId, setCopyTargetParentId] = useState("root");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Step-based UI for the builder section
    const [builderStep, setBuilderStep] = useState<"content" | "schedule" | "tree">("content");

    const authHeaders = () => {
        const token = localStorage.getItem("auth_token");
        return {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const authHeadersForUpload = (): HeadersInit => {
        const token = localStorage.getItem("auth_token");
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    };

    const applyCurriculumPayload = (payload: any) => {
        const nextCurriculum = Array.isArray(payload.curriculum) ? payload.curriculum : [];
        const nextGroups = Array.isArray(payload.groups) ? payload.groups : [];
        const nextComputed = payload.computedReleaseGroupDates || {};

        setCurriculum(nextCurriculum);
        setGroups(nextGroups);
        setComputedGroupDates(nextComputed);

        const nextGroupDrafts: Record<string, string> = {};
        nextGroups.forEach((group: ReleaseGroupSummary) => {
            const dateValue = payload.releaseGroupDates?.[group.id] || nextComputed[group.id] || "";
            nextGroupDrafts[group.id] = toLocalInputDateTime(dateValue);
        });
        setGroupDateDrafts(nextGroupDrafts);

        const nextNodeOverrides: Record<string, string> = {};
        const stack: BuilderCurriculumNode[] = [...nextCurriculum];
        while (stack.length > 0) {
            const node = stack.pop();
            if (!node) continue;
            nextNodeOverrides[node.id] = toLocalInputDateTime(node.releaseAt || null);
            (node.children || []).forEach((child) => stack.push(child));
        }
        setNodeOverrideDrafts(nextNodeOverrides);
    };

    const loadCourses = async () => {
        const response = await fetch("/api/teacher/courses", { method: "GET", headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load courses.");
        const list = Array.isArray(data.courses) ? data.courses : [];
        setCourses(list);
        if (!selectedCourseId && list[0]?.id) setSelectedCourseId(list[0].id);
    };

    const loadTopics = async () => {
        const response = await fetch("/api/teacher/starter-catalog", { method: "GET", headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load starter catalog.");
        setTopics(Array.isArray(data.topics) ? data.topics : []);
    };

    const loadCategories = async () => {
        const list = await fetchCategories();
        setCategories(list);
    };

    const loadCourseContext = async (courseId: string) => {
        if (!courseId) { setCurriculum([]); setGroups([]); setComputedGroupDates({}); return; }
        const response = await fetch(`/api/teacher/courses/${courseId}/curriculum`, { method: "GET", headers: authHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load curriculum.");

        applyCurriculumPayload(data);
        setReleaseMode((data.course?.releaseMode || "fixed_interval") as CourseReleaseModeValue);
        setReleaseStartAt(toLocalInputDateTime(data.course?.releaseStartAt || null));
        setIntervalDays(String(data.course?.releaseIntervalDays || 7));
        setGroupsPerWeek(String(data.course?.releaseGroupsPerWeek || 2));
        setCourseStatus((data.course?.status || "draft") as "draft" | "scheduled" | "published" | "archived");
    };

    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            setLoading(true);
            try { await Promise.all([loadCourses(), loadTopics(), loadCategories()]); if (!cancelled) setMessage(null); }
            catch (error: any) { if (!cancelled) setMessage({ type: "error", text: error.message || "Failed to initialize." }); }
            finally { if (!cancelled) setLoading(false); }
        };
        init();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!newCourseCategoryId && categories[0]?.id) {
            setNewCourseCategoryId(categories[0].id);
        }
    }, [categories, newCourseCategoryId]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            if (!selectedCourseId) return;
            setLoading(true);
            try { await loadCourseContext(selectedCourseId); if (!cancelled) setMessage(null); }
            catch (error: any) { if (!cancelled) setMessage({ type: "error", text: error.message || "Failed to load course." }); }
            finally { if (!cancelled) setLoading(false); }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedCourseId]);

    const folderOptions = useMemo(() => flattenFolderOptions(curriculum), [curriculum]);
    const videoNodes = useMemo(() => collectVideoNodes(curriculum), [curriculum]);

    const handleCreateCourse = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        try {
            const response = await fetch("/api/teacher/courses", {
                method: "POST", headers: authHeaders(),
                body: JSON.stringify({ title: newCourseTitle, categoryId: newCourseCategoryId, price: Number(newCoursePrice), duration: newCourseDuration, description: newCourseDescription }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create course.");
            await loadCourses();
            setSelectedCourseId(data.course.id);
            setNewCourseTitle(""); setNewCourseDescription("");
            setMessage({ type: "success", text: "Course created successfully!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to create course." }); }
        finally { setLoading(false); }
    };

    const handleImportTopics = async () => {
        if (!selectedCourseId || selectedTopics.length === 0) {
            setMessage({ type: "error", text: "Select at least one topic to import." }); return;
        }
        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/import-topics`, {
                method: "POST", headers: authHeaders(), body: JSON.stringify({ mainTopicIds: selectedTopics }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to import topics.");
            applyCurriculumPayload(data);
            setSelectedTopics([]);
            setMessage({ type: "success", text: "Topics imported into course curriculum!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to import." }); }
        finally { setLoading(false); }
    };

    const uploadSelfHostedVideo = async () => {
        if (!uploadFile) return null;
        const formData = new FormData();
        formData.append("file", uploadFile);
        const response = await fetch("/api/teacher/uploads", { method: "POST", headers: authHeadersForUpload(), body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed.");
        return data;
    };

    const handleAddNode = async (event: FormEvent) => {
        event.preventDefault();
        if (!selectedCourseId) { setMessage({ type: "error", text: "Select a course first." }); return; }
        setLoading(true);
        try {
            let finalUrl = newNodeUrl.trim();
            let storagePath: string | undefined;
            if (newNodeType === "self-hosted" && uploadFile) {
                const uploaded = await uploadSelfHostedVideo();
                finalUrl = uploaded?.url || finalUrl;
                storagePath = uploaded?.storagePath;
            }
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum`, {
                method: "POST", headers: authHeaders(),
                body: JSON.stringify({ parentId: targetParentId === "root" ? null : targetParentId, title: newNodeTitle, type: newNodeType, url: finalUrl || null, duration: newNodeDuration || null, storagePath: storagePath || null }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to add node.");
            applyCurriculumPayload(data);
            setNewNodeTitle(""); setNewNodeUrl(""); setNewNodeDuration(""); setUploadFile(null);
            setMessage({ type: "success", text: "Content added to curriculum!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to add content." }); }
        finally { setLoading(false); }
    };

    const handleReuseVideo = async () => {
        if (!selectedCourseId || !copySourceNodeId) { setMessage({ type: "error", text: "Select source video and target folder." }); return; }
        const source = videoNodes.find((n) => n.id === copySourceNodeId);
        if (!source) { setMessage({ type: "error", text: "Source video not found." }); return; }
        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum`, {
                method: "POST", headers: authHeaders(),
                body: JSON.stringify({ parentId: copyTargetParentId === "root" ? null : copyTargetParentId, title: source.title, type: source.type, url: source.url, duration: source.duration, storagePath: source.storagePath }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to reuse video.");
            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Video inserted successfully!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to reuse video." }); }
        finally { setLoading(false); }
    };

    const handleSaveSchedule = async () => {
        if (!selectedCourseId) return;
        setLoading(true);
        try {
            const releaseGroupDates = Object.entries(groupDateDrafts).reduce<Record<string, string>>((acc, [g, v]) => { const iso = toIsoString(v); if (iso) acc[g] = iso; return acc; }, {});
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/scheduling`, {
                method: "PATCH", headers: authHeaders(),
                body: JSON.stringify({ releaseMode, releaseStartAt: toIsoString(releaseStartAt), releaseIntervalDays: Number(intervalDays), releaseGroupsPerWeek: Number(groupsPerWeek), releaseGroupDates, status: courseStatus, timezone: "Asia/Dhaka" }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to save schedule.");
            setComputedGroupDates(data.computedReleaseGroupDates || {});
            await loadCourses();
            setMessage({ type: "success", text: "Schedule saved successfully!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to save schedule." }); }
        finally { setLoading(false); }
    };

    const handleDeleteNode = async (nodeId: string) => {
        if (!selectedCourseId || !confirm("Delete this item and all nested content?")) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum/${nodeId}`, { method: "DELETE", headers: authHeaders() });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to delete.");
            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Item deleted." });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to delete." }); }
        finally { setLoading(false); }
    };

    const handleSaveNodeOverride = async (nodeId: string) => {
        if (!selectedCourseId) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum/${nodeId}`, {
                method: "PATCH", headers: authHeaders(), body: JSON.stringify({ releaseAt: toIsoString(nodeOverrideDrafts[nodeId] || "") }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to save override.");
            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Release date override saved!" });
        } catch (error: any) { setMessage({ type: "error", text: error.message || "Failed to save override." }); }
        finally { setLoading(false); }
    };

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);

    return (
        <div className={styles.builderWrap}>
            {/* ─── Message Toast ─── */}
            {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

            {/* ─── Section 1: Create New Course ─── */}
            <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                    <h2><Plus size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Create New <span className="gradient-text">Course</span></h2>
                </div>
                <div className={styles.sectionInner}>
                    <form className={styles.gridForm} onSubmit={handleCreateCourse}>
                        <div className={styles.formGroup}>
                            <label>Course Title</label>
                            <input type="text" placeholder="e.g. FCPS Part 1 — Complete Package" value={newCourseTitle} onChange={(e) => setNewCourseTitle(e.target.value)} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Category</label>
                            <select value={newCourseCategoryId} onChange={(e) => setNewCourseCategoryId(e.target.value)} required>
                                <option value="">Select a category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.displayName}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Price (BDT)</label>
                            <input type="number" min="0" step="1" placeholder="0 for free" value={newCoursePrice} onChange={(e) => setNewCoursePrice(e.target.value)} required />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Duration</label>
                            <input type="text" placeholder="e.g. 3 Months, 6 Months" value={newCourseDuration} onChange={(e) => setNewCourseDuration(e.target.value)} required />
                        </div>
                        <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                            <label>Description</label>
                            <textarea placeholder="A short description of what the course covers..." value={newCourseDescription} onChange={(e) => setNewCourseDescription(e.target.value)} />
                        </div>
                        <div className={`${styles.btnRow} ${styles.fullWidth}`}>
                            <button type="submit" className={styles.primaryBtn} disabled={loading}>
                                <Plus size={16} /> Create Course
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ─── Section 2: Course Builder ─── */}
            <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                    <h2><BookOpen size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Course <span className="gradient-text">Builder</span></h2>
                    <div className={styles.sectionHeaderMeta}>
                        <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                            <option value="">Select a course...</option>
                            {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedCourseId ? (
                    <>
                        {/* Step Tabs */}
                        <div className={styles.stepIndicator}>
                            <button className={`${styles.step} ${builderStep === "content" ? styles.stepActive : ""}`} onClick={() => setBuilderStep("content")}>
                                <span className={styles.stepNumber}>1</span> Content
                            </button>
                            <div className={styles.stepDivider} />
                            <button className={`${styles.step} ${builderStep === "schedule" ? styles.stepActive : ""}`} onClick={() => setBuilderStep("schedule")}>
                                <span className={styles.stepNumber}>2</span> Schedule
                            </button>
                            <div className={styles.stepDivider} />
                            <button className={`${styles.step} ${builderStep === "tree" ? styles.stepActive : ""}`} onClick={() => setBuilderStep("tree")}>
                                <span className={styles.stepNumber}>3</span> Preview & Override
                            </button>
                        </div>

                        <div className={styles.sectionInner}>

                            {/* ── Step 1: Content ── */}
                            {builderStep === "content" && (
                                <>
                                    {/* Import Topics from Library */}
                                    <div className={styles.importWrap}>
                                        <h3><FolderPlus size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />Import from Video Library</h3>
                                        {topics.length === 0 ? (
                                            <p className={styles.muted}>No topics found in the Video Library. Add videos there first.</p>
                                        ) : (
                                            <>
                                                <div className={styles.topicGrid}>
                                                    {topics.map((topic) => (
                                                        <label key={topic.id} className={styles.topicItem}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedTopics.includes(topic.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedTopics((prev) => [...prev, topic.id]);
                                                                        else setSelectedTopics((prev) => prev.filter((id) => id !== topic.id));
                                                                    }}
                                                                />
                                                                <span>{topic.title}</span>
                                                            </div>
                                                            <small>{topic.subTopicCount} sub-topics • {topic.videoCount} videos</small>
                                                        </label>
                                                    ))}
                                                </div>
                                                <div className={styles.btnRow}>
                                                    <button className={styles.secondaryBtn} onClick={handleImportTopics} disabled={loading || selectedTopics.length === 0}>
                                                        <FolderPlus size={16} /> Import Selected ({selectedTopics.length})
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Add Custom Node */}
                                    <form className={styles.addNodeForm} onSubmit={handleAddNode}>
                                        <h3><Plus size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />Add Custom Content</h3>
                                        <div className={styles.formRow}>
                                            <div className={styles.formGroup}>
                                                <label>Parent Folder</label>
                                                <select value={targetParentId} onChange={(e) => setTargetParentId(e.target.value)}>
                                                    <option value="root">Root (main topic level)</option>
                                                    {folderOptions.map((opt) => (
                                                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>Type</label>
                                                <select value={newNodeType} onChange={(e) => setNewNodeType(e.target.value as any)}>
                                                    <option value="folder">Folder</option>
                                                    <option value="youtube">YouTube</option>
                                                    <option value="self-hosted">Self-hosted</option>
                                                    <option value="document">Document</option>
                                                </select>
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>Title</label>
                                                <input type="text" placeholder="Content title" value={newNodeTitle} onChange={(e) => setNewNodeTitle(e.target.value)} required />
                                            </div>
                                            <div className={styles.formGroup}>
                                                <label>Duration</label>
                                                <input type="text" placeholder="e.g. 45:00" value={newNodeDuration} onChange={(e) => setNewNodeDuration(e.target.value)} />
                                            </div>
                                        </div>

                                        {newNodeType !== "folder" && (
                                            <div className={styles.formRow}>
                                                <div className={`${styles.formGroup}`} style={{ gridColumn: "1 / -1" }}>
                                                    <label>Content URL</label>
                                                    <input type="url" placeholder="https://..." value={newNodeUrl} onChange={(e) => setNewNodeUrl(e.target.value)} required={newNodeType !== "self-hosted"} />
                                                </div>
                                                {newNodeType === "self-hosted" && (
                                                    <label className={styles.uploadLabel}>
                                                        <UploadCloud size={16} /> Upload Video
                                                        <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                        <div className={styles.btnRow}>
                                            <button className={styles.primaryBtn} type="submit" disabled={loading}>
                                                <Plus size={16} /> Add to Curriculum
                                            </button>
                                        </div>
                                    </form>

                                    {/* Reuse Existing Video */}
                                    {videoNodes.length > 0 && (
                                        <div className={styles.reuseWrap}>
                                            <h3><Layers size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />Reuse Existing Video</h3>
                                            <div className={styles.formRow}>
                                                <div className={styles.formGroup}>
                                                    <select value={copySourceNodeId} onChange={(e) => setCopySourceNodeId(e.target.value)}>
                                                        <option value="">Choose source...</option>
                                                        {videoNodes.map((n) => (
                                                            <option key={n.id} value={n.id}>{n.title}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className={styles.formGroup}>
                                                    <select value={copyTargetParentId} onChange={(e) => setCopyTargetParentId(e.target.value)}>
                                                        <option value="root">Root level</option>
                                                        {folderOptions.map((opt) => (
                                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button className={styles.secondaryBtn} onClick={handleReuseVideo} disabled={loading || !copySourceNodeId}>
                                                    <Layers size={16} /> Insert Copy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Step 2: Schedule ── */}
                            {builderStep === "schedule" && (
                                <>
                                    <div className={styles.scheduleGrid}>
                                        <div>
                                            <label>Release Mode</label>
                                            <select value={releaseMode} onChange={(e) => setReleaseMode(e.target.value as CourseReleaseModeValue)}>
                                                <option value="fixed_interval">Fixed Day Interval</option>
                                                <option value="groups_per_week">Groups Per Week (bi/tri-weekly)</option>
                                                <option value="explicit_dates">Explicit Group Dates</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>Start Date (Asia/Dhaka)</label>
                                            <input type="datetime-local" value={releaseStartAt} onChange={(e) => setReleaseStartAt(e.target.value)} />
                                        </div>
                                        {releaseMode === "fixed_interval" && (
                                            <div>
                                                <label>Interval (Days)</label>
                                                <input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                                            </div>
                                        )}
                                        {releaseMode === "groups_per_week" && (
                                            <div>
                                                <label>Groups Per Week</label>
                                                <select value={groupsPerWeek} onChange={(e) => setGroupsPerWeek(e.target.value)}>
                                                    <option value="2">2 (bi-weekly)</option>
                                                    <option value="3">3 (tri-weekly)</option>
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <label>Publish Status</label>
                                            <select value={courseStatus} onChange={(e) => setCourseStatus(e.target.value as any)}>
                                                <option value="draft">Draft</option>
                                                <option value="scheduled">Scheduled</option>
                                                <option value="published">Published</option>
                                                <option value="archived">Archived</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className={styles.btnRow}>
                                        <button className={styles.primaryBtn} onClick={handleSaveSchedule} disabled={loading}>
                                            <Save size={16} /> Save Schedule & Status
                                        </button>
                                    </div>

                                    {/* Release Group Dates */}
                                    <div className={styles.groupsTable}>
                                        <h3><Calendar size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />Release Group Dates</h3>
                                        {groups.length === 0 ? (
                                            <p className={styles.muted}>No release groups yet. Import topics or add content first.</p>
                                        ) : (
                                            groups.map((group) => (
                                                <div key={group.id} className={styles.groupRow}>
                                                    <div>
                                                        <strong>{group.mainTopicTitle} › {group.title}</strong>
                                                        <p>{computedGroupDates[group.id] ? `Computed: ${formatDisplayDate(computedGroupDates[group.id])}` : "No date computed"}</p>
                                                    </div>
                                                    <input
                                                        type="datetime-local"
                                                        value={groupDateDrafts[group.id] || ""}
                                                        onChange={(e) => setGroupDateDrafts((prev) => ({ ...prev, [group.id]: e.target.value }))}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}

                            {/* ── Step 3: Preview & Override ── */}
                            {builderStep === "tree" && (
                                <div className={styles.curriculumTree}>
                                    <h3>Curriculum Tree — {selectedCourse?.title || "Untitled"}</h3>
                                    {curriculum.length === 0 ? (
                                        <div className={styles.emptyState}>
                                            <FolderOpen size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
                                            <h3>No Content Yet</h3>
                                            <p>Go to the Content step to import topics or add videos.</p>
                                        </div>
                                    ) : (
                                        curriculum.map((node) => (
                                            <NodeRow
                                                key={node.id}
                                                node={node}
                                                depth={0}
                                                overrideDrafts={nodeOverrideDrafts}
                                                onOverrideChange={(nodeId, value) => setNodeOverrideDrafts((prev) => ({ ...prev, [nodeId]: value }))}
                                                onSaveOverride={handleSaveNodeOverride}
                                                onDelete={handleDeleteNode}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <BookOpen size={48} style={{ opacity: 0.4, marginBottom: 16 }} />
                        <h3>Select or Create a Course</h3>
                        <p>Choose an existing course from the dropdown above, or create a new one.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
