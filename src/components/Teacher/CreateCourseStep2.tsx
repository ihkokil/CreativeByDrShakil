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

        const [sessionResponse, teachersResponse, courseResponse] = await Promise.all([
          fetch("/api/auth/session", { headers }),
          fetch("/api/teachers", { headers }),
          fetch(`/api/teacher/courses/${courseId}`, { headers }),
        ]);

        if (!courseResponse.ok) throw new Error("Failed to fetch course");

        let loadedTeachers: TeacherOption[] = [];
        if (teachersResponse.ok) {
          const teacherData = await teachersResponse.json();
          loadedTeachers = Array.isArray(teacherData.teachers) ? teacherData.teachers : [];
          setTeachers(loadedTeachers);
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
          <p className={styles.subtitle}>Step 2 of 4: Overview & Instructors</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "50%" }} />
          </div>
          <span className={styles.progressText}>50%</span>
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
