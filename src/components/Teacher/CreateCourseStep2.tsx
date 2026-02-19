"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";
import styles from "./CreateCourseStep2.module.css";

interface TeacherOption {
  id: string;
  full_name: string;
  designation?: string | null;
}

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

interface SessionUser {
  id: string;
  role: string;
  user_metadata?: {
    full_name?: string;
  };
}

function CreateCourseStep2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  const [loading, setLoading] = useState(!courseId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
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

        const [sessionResponse, teachersResponse, topicsResponse, videoResponse, courseResponse] = await Promise.all([
          fetch("/api/auth/session", { headers }),
          fetch("/api/teachers", { headers }),
          fetch("/api/teacher/starter-catalog", { headers }),
          fetch("/api/teacher/video-library", { headers }),
          fetch(`/api/teacher/courses/${courseId}`, { headers }),
        ]);

        if (!courseResponse.ok) throw new Error("Failed to fetch course");

        let loadedTeachers: TeacherOption[] = [];
        if (teachersResponse.ok) {
          const teacherData = await teachersResponse.json();
          loadedTeachers = Array.isArray(teacherData.teachers) ? teacherData.teachers : [];
          setTeachers(loadedTeachers);
        }

        if (topicsResponse.ok) {
          const topicData = await topicsResponse.json();
          setTopicOptions(Array.isArray(topicData.topics) ? topicData.topics : []);
        }

        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          const nodes: LibraryNode[] = Array.isArray(videoData.nodes) ? videoData.nodes : [];
          setVideoOptions(nodes.filter((node) => node.type !== "folder" && Boolean(node.url)));
        }

        const courseData = await courseResponse.json();
        const course = courseData.course;

        setOverview(course.overview || "");
        setLearningOutcomes(course.learningOutcomes || "");

        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          const user: SessionUser | null = sessionData.user || null;
          if (user?.id && user.role === "teacher") {
            setCurrentTeacherId(user.id);
          }
        }

        const selectedIdsFromCourse = Array.isArray(course.instructors)
          ? course.instructors
              .map((instructor: { name: string }) => {
                const match = loadedTeachers.find((teacher: TeacherOption) => teacher.full_name === instructor.name);
                return match?.id || null;
              })
              .filter((id: string | null): id is string => Boolean(id))
          : [];

        if (selectedIdsFromCourse.length > 0) {
          setSelectedTeacherIds(selectedIdsFromCourse);
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

  useEffect(() => {
    if (!currentTeacherId) return;
    setSelectedTeacherIds((prev) => (prev.includes(currentTeacherId) ? prev : [currentTeacherId, ...prev]));
  }, [currentTeacherId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!overview.trim()) {
      setError("Course overview is required");
      return;
    }

    const selectedInstructors = teachers.filter((teacher) => selectedTeacherIds.includes(teacher.id));
    if (!selectedInstructors.length) {
      setError("At least one instructor is required");
      return;
    }

    setSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const validInstructors = selectedInstructors.map((teacher) => ({
        name: teacher.full_name,
        designation: teacher.designation || "",
      }));

      const response = await fetch(`/api/teacher/courses/${courseId}/content`, {
        method: "POST",
        body: JSON.stringify({
          overview,
          learningOutcomes,
          instructors: validInstructors,
        }),
        headers,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save content");
      }

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

      // Redirect to step 3
      router.push(`/teacher/dashboard/courses/create/outline?courseId=${courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save content");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Course Content</h1>
          <p className={styles.subtitle}>Step 2 of 3: Overview & Instructors</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "66%" }} />
          </div>
          <span className={styles.progressText}>66%</span>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Course Overview</h2>
          <p className={styles.sectionDesc}>
            Provide a detailed description of what students will learn
          </p>

          <textarea
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Write your course overview here. You can use basic formatting like:
- Bold text in **asterisks**
- Line breaks for paragraphs
- Lists with bullet points"
            className={styles.textarea}
            rows={8}
            required
          />
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Learning Outcomes</h2>
          <p className={styles.sectionDesc}>
            List key takeaways (one per line, will be displayed as bullet points)
          </p>

          <textarea
            value={learningOutcomes}
            onChange={(e) => setLearningOutcomes(e.target.value)}
            placeholder="E.g., Understand diagnostic criteria&#10;Master clinical examination techniques&#10;Learn treatment protocols"
            className={styles.textarea}
            rows={6}
          />
          <p className={styles.hint}>
            Tip: Enter each outcome on a new line for better formatting
          </p>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Instructors</h2>
          <p className={styles.sectionDesc}>
            The course creator is selected by default. You can add additional instructors from existing teachers.
          </p>

          <div className={styles.selectionGrid}>
            {teachers.map((teacher) => {
              const checked = selectedTeacherIds.includes(teacher.id);
              const isDefaultTeacher = currentTeacherId === teacher.id;
              return (
                <label key={teacher.id} className={styles.selectionCard}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (isDefaultTeacher) return;
                      toggleSelection(teacher.id, setSelectedTeacherIds);
                    }}
                    disabled={isDefaultTeacher}
                  />
                  <div>
                    <strong>{teacher.full_name}</strong>
                    <p>{teacher.designation || "Teacher"}</p>
                    {isDefaultTeacher && <small>Default course teacher</small>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Module Options</h2>
          <p className={styles.sectionDesc}>
            Select starter modules to import into this course curriculum.
          </p>

          <div className={styles.selectionGrid}>
            {topicOptions.map((topic) => (
              <label key={topic.id} className={styles.selectionCard}>
                <input
                  type="checkbox"
                  checked={selectedTopicIds.includes(topic.id)}
                  onChange={() => toggleSelection(topic.id, setSelectedTopicIds)}
                />
                <div>
                  <strong>{topic.title}</strong>
                  <p>{topic.subTopicCount} sub-topics · {topic.videoCount} videos</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Video Library Options</h2>
          <p className={styles.sectionDesc}>
            Pick videos/documents from your existing library to append to this course.
          </p>

          <div className={styles.selectionGrid}>
            {videoOptions.map((node) => (
              <label key={node.id} className={styles.selectionCard}>
                <input
                  type="checkbox"
                  checked={selectedVideoIds.includes(node.id)}
                  onChange={() => toggleSelection(node.id, setSelectedVideoIds)}
                />
                <div>
                  <strong>{node.title}</strong>
                  <p>{node.type}{node.duration ? ` · ${node.duration}` : ""}</p>
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
            disabled={submitting || loading}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/create?courseId=${courseId}`)
            }
            className={styles.backBtn}
            disabled={submitting}
          >
            <ArrowLeft size={20} /> Back
          </button>

          <button
            type="submit"
            className={styles.nextBtn}
            disabled={submitting || loading}
          >
            {submitting ? "Saving..." : "Next"}
            <ArrowRight size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CreateCourseStep2() {
  return (
    <Suspense fallback={<div style={{ padding: "20px" }}>Loading...</div>}>
      <CreateCourseStep2Content />
    </Suspense>
  );
}
