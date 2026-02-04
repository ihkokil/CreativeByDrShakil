"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
    BuilderCurriculumNode,
    CourseReleaseModeValue,
    collectVideoNodes,
} from "@/lib/teacher-course-builder";
import styles from "./TeacherCourseBuilder.module.css";
import { FolderPlus, Plus, Save, Trash2, UploadCloud } from "lucide-react";

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
                options.push({ id: node.id, label: nextTrail.join(" > ") });
            }
            if (node.children?.length) {
                walk(node.children, nextTrail);
            }
        });
    };

    walk(nodes, []);
    return options;
};

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
    return (
        <div className={styles.nodeWrap}>
            <div className={styles.nodeRow} style={{ paddingLeft: `${depth * 18 + 12}px` }}>
                <div className={styles.nodeMeta}>
                    <strong>{node.title}</strong>
                    <span>{node.type}</span>
                    {node.releaseGroupId && <span className={styles.groupTag}>Group: {node.releaseGroupId.slice(0, 18)}</span>}
                </div>

                <div className={styles.nodeActions}>
                    <input
                        type="datetime-local"
                        value={overrideDrafts[node.id] || ""}
                        onChange={(event) => onOverrideChange(node.id, event.target.value)}
                    />
                    <button className={styles.ghostBtn} onClick={() => onSaveOverride(node.id)}>
                        Save Override
                    </button>
                    <button className={styles.dangerBtn} onClick={() => onDelete(node.id)}>
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

export default function TeacherCourseBuilder() {
    const [courses, setCourses] = useState<TeacherCourseSummary[]>([]);
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
    const [newCourseCategory, setNewCourseCategory] = useState("FCPS");
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
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
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
        const response = await fetch("/api/teacher/courses", {
            method: "GET",
            headers: authHeaders(),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to load courses.");
        }

        const list = Array.isArray(data.courses) ? data.courses : [];
        setCourses(list);

        if (!selectedCourseId && list[0]?.id) {
            setSelectedCourseId(list[0].id);
        }
    };

    const loadTopics = async () => {
        const response = await fetch("/api/teacher/starter-catalog", {
            method: "GET",
            headers: authHeaders(),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to load starter catalog.");
        }

        setTopics(Array.isArray(data.topics) ? data.topics : []);
    };

    const loadCourseContext = async (courseId: string) => {
        if (!courseId) {
            setCurriculum([]);
            setGroups([]);
            setComputedGroupDates({});
            return;
        }

        const response = await fetch(`/api/teacher/courses/${courseId}/curriculum`, {
            method: "GET",
            headers: authHeaders(),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Failed to load curriculum.");
        }

        applyCurriculumPayload(data);

        setReleaseMode((data.course?.releaseMode || "fixed_interval") as CourseReleaseModeValue);
        setReleaseStartAt(toLocalInputDateTime(data.course?.releaseStartAt || null));
        setIntervalDays(String(data.course?.releaseIntervalDays || 7));
        setGroupsPerWeek(String(data.course?.releaseGroupsPerWeek || 2));
        setCourseStatus((data.course?.status || "draft") as "draft" | "scheduled" | "published" | "archived");
    };

    useEffect(() => {
        let cancelled = false;

        const loadInitialData = async () => {
            setLoading(true);
            try {
                await Promise.all([loadCourses(), loadTopics()]);
                if (!cancelled) {
                    setMessage(null);
                }
            } catch (error: any) {
                if (!cancelled) {
                    setMessage({ type: "error", text: error.message || "Failed to initialize course builder." });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadInitialData();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (!selectedCourseId) {
                return;
            }

            setLoading(true);
            try {
                await loadCourseContext(selectedCourseId);
                if (!cancelled) {
                    setMessage(null);
                }
            } catch (error: any) {
                if (!cancelled) {
                    setMessage({ type: "error", text: error.message || "Failed to load course builder context." });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [selectedCourseId]);

    const folderOptions = useMemo(() => flattenFolderOptions(curriculum), [curriculum]);
    const videoNodes = useMemo(() => collectVideoNodes(curriculum), [curriculum]);

    const handleCreateCourse = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);

        try {
            const response = await fetch("/api/teacher/courses", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    title: newCourseTitle,
                    category: newCourseCategory,
                    price: Number(newCoursePrice),
                    duration: newCourseDuration,
                    description: newCourseDescription,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to create course.");
            }

            await loadCourses();
            setSelectedCourseId(data.course.id);
            setNewCourseTitle("");
            setNewCourseDescription("");
            setMessage({ type: "success", text: "Course created successfully." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to create course." });
        } finally {
            setLoading(false);
        }
    };

    const handleImportTopics = async () => {
        if (!selectedCourseId || selectedTopics.length === 0) {
            setMessage({ type: "error", text: "Select at least one main topic to import." });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/import-topics`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ mainTopicIds: selectedTopics }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to import topics.");
            }

            applyCurriculumPayload(data);
            setSelectedTopics([]);
            setMessage({ type: "success", text: "Starter topics imported into course." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to import topics." });
        } finally {
            setLoading(false);
        }
    };

    const uploadSelfHostedVideo = async () => {
        if (!uploadFile) return null;

        const formData = new FormData();
        formData.append("file", uploadFile);

        const response = await fetch("/api/teacher/uploads", {
            method: "POST",
            headers: authHeadersForUpload(),
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Upload failed.");
        }

        return data;
    };

    const handleAddNode = async (event: FormEvent) => {
        event.preventDefault();
        if (!selectedCourseId) {
            setMessage({ type: "error", text: "Select a course first." });
            return;
        }

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
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    parentId: targetParentId === "root" ? null : targetParentId,
                    title: newNodeTitle,
                    type: newNodeType,
                    url: finalUrl || null,
                    duration: newNodeDuration || null,
                    storagePath: storagePath || null,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to add node.");
            }

            applyCurriculumPayload(data);
            setNewNodeTitle("");
            setNewNodeUrl("");
            setNewNodeDuration("");
            setUploadFile(null);
            setMessage({ type: "success", text: "Node added to curriculum." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to add node." });
        } finally {
            setLoading(false);
        }
    };

    const handleReuseVideo = async () => {
        if (!selectedCourseId || !copySourceNodeId) {
            setMessage({ type: "error", text: "Select source video and target folder." });
            return;
        }

        const source = videoNodes.find((node) => node.id === copySourceNodeId);
        if (!source) {
            setMessage({ type: "error", text: "Selected source video not found." });
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum`, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    parentId: copyTargetParentId === "root" ? null : copyTargetParentId,
                    title: source.title,
                    type: source.type,
                    url: source.url,
                    duration: source.duration,
                    storagePath: source.storagePath,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to reuse video.");
            }

            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Existing video inserted at target location." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to reuse existing video." });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSchedule = async () => {
        if (!selectedCourseId) return;

        setLoading(true);
        try {
            const releaseGroupDates = Object.entries(groupDateDrafts).reduce<Record<string, string>>((acc, [groupId, value]) => {
                const isoValue = toIsoString(value);
                if (isoValue) {
                    acc[groupId] = isoValue;
                }
                return acc;
            }, {});

            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/scheduling`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({
                    releaseMode,
                    releaseStartAt: toIsoString(releaseStartAt),
                    releaseIntervalDays: Number(intervalDays),
                    releaseGroupsPerWeek: Number(groupsPerWeek),
                    releaseGroupDates,
                    status: courseStatus,
                    timezone: "Asia/Dhaka",
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to save schedule settings.");
            }

            setComputedGroupDates(data.computedReleaseGroupDates || {});
            await loadCourses();
            setMessage({ type: "success", text: "Schedule settings saved." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to save schedule settings." });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteNode = async (nodeId: string) => {
        if (!selectedCourseId) return;
        if (!confirm("Delete this item and all nested content?")) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum/${nodeId}`, {
                method: "DELETE",
                headers: authHeaders(),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to delete node.");
            }

            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Node deleted." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to delete node." });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveNodeOverride = async (nodeId: string) => {
        if (!selectedCourseId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/teacher/courses/${selectedCourseId}/curriculum/${nodeId}`, {
                method: "PATCH",
                headers: authHeaders(),
                body: JSON.stringify({
                    releaseAt: toIsoString(nodeOverrideDrafts[nodeId] || ""),
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to save manual override.");
            }

            applyCurriculumPayload(data);
            setMessage({ type: "success", text: "Manual release date override updated." });
        } catch (error: any) {
            setMessage({ type: "error", text: error.message || "Failed to save manual override." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.builderWrap}>
            <section className={styles.sectionCard}>
                <h2>Create Teacher Course</h2>
                <form className={styles.gridForm} onSubmit={handleCreateCourse}>
                    <input
                        type="text"
                        placeholder="Course title"
                        value={newCourseTitle}
                        onChange={(event) => setNewCourseTitle(event.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Category"
                        value={newCourseCategory}
                        onChange={(event) => setNewCourseCategory(event.target.value)}
                        required
                    />
                    <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Price"
                        value={newCoursePrice}
                        onChange={(event) => setNewCoursePrice(event.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Duration"
                        value={newCourseDuration}
                        onChange={(event) => setNewCourseDuration(event.target.value)}
                        required
                    />
                    <textarea
                        placeholder="Short description"
                        value={newCourseDescription}
                        onChange={(event) => setNewCourseDescription(event.target.value)}
                    />
                    <button type="submit" className={styles.primaryBtn} disabled={loading}>
                        <Plus size={15} /> Create Course
                    </button>
                </form>
            </section>

            <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                    <h2>Course Builder</h2>
                    <select
                        value={selectedCourseId}
                        onChange={(event) => setSelectedCourseId(event.target.value)}
                    >
                        <option value="">Select course</option>
                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.title} ({course.status})
                            </option>
                        ))}
                    </select>
                </div>

                {selectedCourseId && (
                    <>
                        <div className={styles.scheduleGrid}>
                            <div>
                                <label>Release Mode</label>
                                <select value={releaseMode} onChange={(event) => setReleaseMode(event.target.value as CourseReleaseModeValue)}>
                                    <option value="fixed_interval">Fixed Day Interval</option>
                                    <option value="groups_per_week">Groups Per Week (2/3)</option>
                                    <option value="explicit_dates">Explicit Group Dates</option>
                                </select>
                            </div>
                            <div>
                                <label>Start Date (Asia/Dhaka)</label>
                                <input
                                    type="datetime-local"
                                    value={releaseStartAt}
                                    onChange={(event) => setReleaseStartAt(event.target.value)}
                                />
                            </div>
                            <div>
                                <label>Interval Days</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={intervalDays}
                                    onChange={(event) => setIntervalDays(event.target.value)}
                                />
                            </div>
                            <div>
                                <label>Groups Per Week</label>
                                <select value={groupsPerWeek} onChange={(event) => setGroupsPerWeek(event.target.value)}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                </select>
                            </div>
                            <div>
                                <label>Publish Status</label>
                                <select
                                    value={courseStatus}
                                    onChange={(event) => setCourseStatus(event.target.value as "draft" | "scheduled" | "published" | "archived")}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            <button className={styles.primaryBtn} onClick={handleSaveSchedule} disabled={loading}>
                                <Save size={15} /> Save Schedule & Status
                            </button>
                        </div>

                        <div className={styles.groupsTable}>
                            <h3>Second-child release groups</h3>
                            {groups.length === 0 ? (
                                <p className={styles.muted}>No groups yet. Import starter topics or add second-level content under a main topic.</p>
                            ) : (
                                groups.map((group) => (
                                    <div key={group.id} className={styles.groupRow}>
                                        <div>
                                            <strong>{group.mainTopicTitle} / {group.title}</strong>
                                            <p>{computedGroupDates[group.id] ? new Date(computedGroupDates[group.id]).toLocaleString() : "No computed date"}</p>
                                        </div>
                                        <input
                                            type="datetime-local"
                                            value={groupDateDrafts[group.id] || ""}
                                            onChange={(event) =>
                                                setGroupDateDrafts((prev) => ({
                                                    ...prev,
                                                    [group.id]: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                ))
                            )}
                        </div>

                        <div className={styles.importWrap}>
                            <h3>Import Main Topics</h3>
                            <div className={styles.topicGrid}>
                                {topics.map((topic) => (
                                    <label key={topic.id} className={styles.topicItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTopics.includes(topic.id)}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedTopics((prev) => [...prev, topic.id]);
                                                } else {
                                                    setSelectedTopics((prev) => prev.filter((item) => item !== topic.id));
                                                }
                                            }}
                                        />
                                        <span>{topic.title}</span>
                                        <small>{topic.subTopicCount} sub-topics • {topic.videoCount} videos</small>
                                    </label>
                                ))}
                            </div>
                            <button className={styles.secondaryBtn} onClick={handleImportTopics} disabled={loading}>
                                <FolderPlus size={15} /> Import Selected Topics
                            </button>
                        </div>

                        <form className={styles.addNodeForm} onSubmit={handleAddNode}>
                            <h3>Add Folder/Video Anywhere</h3>
                            <div className={styles.formRow}>
                                <select value={targetParentId} onChange={(event) => setTargetParentId(event.target.value)}>
                                    <option value="root">Root (main topic level)</option>
                                    {folderOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                                <select value={newNodeType} onChange={(event) => setNewNodeType(event.target.value as "folder" | "youtube" | "self-hosted" | "document") }>
                                    <option value="folder">Folder</option>
                                    <option value="youtube">YouTube</option>
                                    <option value="self-hosted">Self-hosted</option>
                                    <option value="document">Document</option>
                                </select>
                                <input
                                    type="text"
                                    placeholder="Title"
                                    value={newNodeTitle}
                                    onChange={(event) => setNewNodeTitle(event.target.value)}
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Duration (optional)"
                                    value={newNodeDuration}
                                    onChange={(event) => setNewNodeDuration(event.target.value)}
                                />
                            </div>

                            {newNodeType !== "folder" && (
                                <div className={styles.formRow}>
                                    <input
                                        type="url"
                                        placeholder="Content URL"
                                        value={newNodeUrl}
                                        onChange={(event) => setNewNodeUrl(event.target.value)}
                                        required={newNodeType !== "self-hosted"}
                                    />
                                    {newNodeType === "self-hosted" && (
                                        <label className={styles.uploadLabel}>
                                            <UploadCloud size={15} /> Upload File
                                            <input
                                                type="file"
                                                accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                                                onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                                            />
                                        </label>
                                    )}
                                </div>
                            )}

                            <button className={styles.primaryBtn} type="submit" disabled={loading}>
                                <Plus size={15} /> Add Node
                            </button>
                        </form>

                        <div className={styles.reuseWrap}>
                            <h3>Reuse Existing Video</h3>
                            <div className={styles.formRow}>
                                <select value={copySourceNodeId} onChange={(event) => setCopySourceNodeId(event.target.value)}>
                                    <option value="">Choose source video</option>
                                    {videoNodes.map((node) => (
                                        <option key={node.id} value={node.id}>{node.title}</option>
                                    ))}
                                </select>
                                <select value={copyTargetParentId} onChange={(event) => setCopyTargetParentId(event.target.value)}>
                                    <option value="root">Root (main topic level)</option>
                                    {folderOptions.map((option) => (
                                        <option key={option.id} value={option.id}>{option.label}</option>
                                    ))}
                                </select>
                                <button className={styles.secondaryBtn} onClick={handleReuseVideo} disabled={loading}>
                                    Insert Existing Video
                                </button>
                            </div>
                        </div>

                        <div className={styles.curriculumTree}>
                            <h3>Curriculum Tree</h3>
                            {curriculum.length === 0 ? (
                                <p className={styles.muted}>No curriculum yet. Import topics or add nodes manually.</p>
                            ) : (
                                curriculum.map((node) => (
                                    <NodeRow
                                        key={node.id}
                                        node={node}
                                        depth={0}
                                        overrideDrafts={nodeOverrideDrafts}
                                        onOverrideChange={(nodeId, value) =>
                                            setNodeOverrideDrafts((prev) => ({
                                                ...prev,
                                                [nodeId]: value,
                                            }))
                                        }
                                        onSaveOverride={handleSaveNodeOverride}
                                        onDelete={handleDeleteNode}
                                    />
                                ))
                            )}
                        </div>
                    </>
                )}
            </section>

            {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}
        </div>
    );
}
