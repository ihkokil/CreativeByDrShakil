"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import styles from "./CreateCourseStep2.module.css";

interface Instructor {
  id?: string;
  name: string;
  designation?: string;
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
  const [instructors, setInstructors] = useState<Instructor[]>([
    { name: "", designation: "" },
  ]);

  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("auth_token");

        const response = await fetch(`/api/teacher/courses/${courseId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) throw new Error("Failed to fetch course");

        const data = await response.json();
        const course = data.course;

        setOverview(course.overview || "");
        setLearningOutcomes(course.learningOutcomes || "");
        setInstructors(
          course.instructors && course.instructors.length > 0
            ? course.instructors
            : [{ name: "", designation: "" }]
        );

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  const handleInstructorChange = (
    index: number,
    field: "name" | "designation",
    value: string
  ) => {
    const updated = [...instructors];
    updated[index] = { ...updated[index], [field]: value };
    setInstructors(updated);
  };

  const handleAddInstructor = () => {
    setInstructors([...instructors, { name: "", designation: "" }]);
  };

  const handleRemoveInstructor = (index: number) => {
    if (instructors.length > 1) {
      setInstructors(instructors.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!overview.trim()) {
      setError("Course overview is required");
      return;
    }

    if (!instructors.some((i) => i.name.trim())) {
      setError("At least one instructor is required");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("auth_token");

      const validInstructors = instructors.filter((i) => i.name.trim());

      const response = await fetch(`/api/teacher/courses/${courseId}/content`, {
        method: "POST",
        body: JSON.stringify({
          overview,
          learningOutcomes,
          instructors: validInstructors,
        }),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
            Add one or more instructors for this course
          </p>

          <div className={styles.instructorsList}>
            {instructors.map((instructor, index) => (
              <div key={index} className={styles.instructorCard}>
                <div className={styles.instructorNumber}>#{index + 1}</div>

                <div className={styles.instructorForm}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      Name <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      value={instructor.name}
                      onChange={(e) =>
                        handleInstructorChange(index, "name", e.target.value)
                      }
                      placeholder="Instructor name"
                      className={styles.input}
                      required
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>Designation</label>
                    <input
                      type="text"
                      value={instructor.designation || ""}
                      onChange={(e) =>
                        handleInstructorChange(index, "designation", e.target.value)
                      }
                      placeholder="E.g., Dr., Professor, Consultant"
                      className={styles.input}
                    />
                  </div>
                </div>

                {instructors.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemoveInstructor(index)}
                    title="Remove instructor"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddInstructor}
            className={styles.addInstructorBtn}
          >
            <Plus size={20} /> Add Another Instructor
          </button>
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
