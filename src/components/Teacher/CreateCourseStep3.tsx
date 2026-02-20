"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers, Library } from "lucide-react";
import styles from "./CreateCourseStep3.module.css";

interface TopicOption {
  id: string;
  title: string;
  subTopicCount: number;
  videoCount: number;
}

interface LibraryNode {
  id: string;
  title: string;
  type: "folder" | "youtube" | "self-hosted" | "document";
  url: string | null;
  duration: string | null;
  parentId: string | null;
}

function CreateCourseStep3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topicOptions, setTopicOptions] = useState<TopicOption[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [videoOptions, setVideoOptions] = useState<LibraryNode[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const toggleSelection = (value: string, setter: (updater: (prev: string[]) => string[]) => void) => {
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  useEffect(() => {
    if (!courseId) return;

    const initStep = async () => {
      try {
        setLoading(true);
        const headers = getAuthHeaders();

        const [topicsResponse, videoResponse] = await Promise.all([
          fetch("/api/teacher/starter-catalog", { headers }),
          fetch("/api/teacher/video-library", { headers }),
        ]);

        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          setTopicOptions(Array.isArray(topicData.topics) ? topicData.topics : []);
        }

        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          setVideoOptions(nodes.filter((node) => node.type !== "folder" && Boolean(node.url)));
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    initStep();
  }, [courseId]);

  const handleSaveAndContinue = async () => {
    if (!courseId) return;

    setSaving(true);
    try {
      const headers = getAuthHeaders();

      if (selectedTopicIds.length > 0) {
        const topicImportResponse = await fetch(`/api/teacher/courses/${courseId}/import-topics`, {
          method: "POST",
          headers,
          body: JSON.stringify({ mainTopicIds: selectedTopicIds }),
        });

        if (!topicImportResponse.ok) {
          const topicError = await topicImportResponse.json();
          throw new Error(topicError.error || "Failed to import selected modules.");
        }
      }

      const selectedVideoNodes = videoOptions.filter((node) => selectedVideoIds.includes(node.id));
      if (selectedVideoNodes.length > 0) {
        for (const node of selectedVideoNodes) {
          const addVideoResponse = await fetch(`/api/teacher/courses/${courseId}/curriculum`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              title: node.title,
              type: node.type,
              duration: node.duration,
              url: node.url,
              parentId: null,
            }),
          });

          if (!addVideoResponse.ok) {
            const addVideoError = await addVideoResponse.json();
            throw new Error(addVideoError.error || `Failed to add video: ${node.title}`);
          }
        }
      }

      // Redirect to step 4 (review + publish)
      router.push(`/teacher/dashboard/courses/create/review?courseId=${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save module and media options");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading options...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Modules & Media</h1>
          <p className={styles.subtitle}>Step 3 of 4: Select modules and media library items</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "75%" }} />
          </div>
          <span className={styles.progressText}>75%</span>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.reviewContent}>
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Module Options</h2>
          <p className={styles.helperText}>Select starter modules to import into this course.</p>
          <div className={styles.selectionGrid}>
            {topicOptions.length === 0 && <p className={styles.emptyText}>No starter modules available.</p>}
            {topicOptions.map((topic) => (
              <label key={topic.id} className={styles.selectionCard}>
                <input
                  type="checkbox"
                  checked={selectedTopicIds.includes(topic.id)}
                  onChange={() => toggleSelection(topic.id, setSelectedTopicIds)}
                />
                <div>
                  <strong>{topic.title}</strong>
                  <p><Layers size={14} /> {topic.subTopicCount} sub-topics · {topic.videoCount} videos</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Video Library Options</h2>
          <p className={styles.helperText}>Pick videos/documents from your existing media library.</p>
          <div className={styles.selectionGrid}>
            {videoOptions.length === 0 && (
              <p className={styles.emptyText}>No video library items available. Add media first from Teacher Dashboard → Library.</p>
            )}
            {videoOptions.map((node) => (
              <label key={node.id} className={styles.selectionCard}>
                <input
                  type="checkbox"
                  checked={selectedVideoIds.includes(node.id)}
                  onChange={() => toggleSelection(node.id, setSelectedVideoIds)}
                />
                <div>
                  <strong>{node.title}</strong>
                  <p><Library size={14} /> {node.type}{node.duration ? ` · ${node.duration}` : ""}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard")}
            className={styles.cancelBtn}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/create/content?courseId=${courseId}`)
            }
            className={styles.backBtn}
            disabled={saving}
          >
            <ArrowLeft size={20} /> Back
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            className={styles.publishBtn}
            disabled={saving}
          >
            {saving ? "Saving..." : <><ArrowRight size={20} /> Next: Review</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateCourseStep3() {
  return (
    <Suspense fallback={<div style={{ padding: "20px" }}>Loading...</div>}>
      <CreateCourseStep3Content />
    </Suspense>
  );
}
