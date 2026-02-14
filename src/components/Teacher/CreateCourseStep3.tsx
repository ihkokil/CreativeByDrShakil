"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertCircle, Loader } from "lucide-react";
import Image from "next/image";
import styles from "./CreateCourseStep3.module.css";

interface CourseData {
  id: string;
  title: string;
  imageUrl?: string;
  category: { displayName: string };
  price: number;
  salePrice?: number;
  duration: string;
  courseStartDate?: string;
  overview: string;
  learningOutcomes: string;
  instructors: Array<{ name: string; designation?: string }>;
}

function CreateCourseStep3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasErrors, setHasErrors] = useState(false);

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
        setCourse(data.course);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load course");
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  useEffect(() => {
    if (!course) return;

    // Validation check
    const errors: string[] = [];
    if (!course.title) errors.push("title");
    if (!course.overview) errors.push("overview");
    if (!course.instructors || course.instructors.length === 0) errors.push("instructors");

    setHasErrors(errors.length > 0);
  }, [course]);

  const handlePublish = async () => {
    if (!courseId) return;

    setPublishing(true);
    try {
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`/api/teacher/courses/${courseId}/publish`, {
        method: "POST",
        body: JSON.stringify({ status: "published" }),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to publish");
      }

      // Redirect to dashboard
      router.push("/teacher/dashboard?tab=courses&published=true");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish course");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading course details...</div>;
  }

  if (!course) {
    return <div className={styles.error}>Course not found</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Review & Publish</h1>
          <p className={styles.subtitle}>Step 3 of 3: Review all details before publishing</p>
        </div>
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: "100%" }} />
          </div>
          <span className={styles.progressText}>100%</span>
        </div>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}

      {hasErrors && (
        <div className={styles.validationWarning}>
          <AlertCircle size={20} />
          <span>Please complete all required fields before publishing</span>
        </div>
      )}

      <div className={styles.reviewContent}>
        {/* Basic Info */}
        <div className={styles.reviewSection}>
          <h2 className={styles.sectionTitle}>Course Information</h2>

          <div className={styles.overviewCard}>
            {course.imageUrl && (
              <div className={styles.previewImage}>
                <Image
                  src={course.imageUrl}
                  alt={course.title}
                  width={300}
                  height={200}
                  className={styles.courseImage}
                />
              </div>
            )}

            <div className={styles.overviewInfo}>
              <h3 className={styles.courseTitle}>{course.title}</h3>
              <p className={styles.courseCategory}>{course.category?.displayName || "General"}</p>

              <div className={styles.courseMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Price:</span>
                  <span className={styles.metaValue}>
                    ৳{course.price}
                    {course.salePrice && (
                      <span className={styles.salePrice}>
                        {" "}
                        (Sale: ৳{course.salePrice})
                      </span>
                    )}
                  </span>
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Duration:</span>
                  <span className={styles.metaValue}>{course.duration}</span>
                </div>
                {course.courseStartDate && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Start Date:</span>
                    <span className={styles.metaValue}>
                      {new Date(course.courseStartDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Course Overview</h2>
          <div className={styles.contentBody}>{course.overview}</div>
        </div>

        {/* Learning Outcomes */}
        {course.learningOutcomes && (
          <div className={styles.contentCard}>
            <h2 className={styles.contentTitle}>Learning Outcomes</h2>
            <ul className={styles.outcomesList}>
              {course.learningOutcomes.split("\n").map((outcome, index) => (
                <li key={index}>{outcome.trim()}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructors */}
        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Instructors</h2>
          <div className={styles.instructorsGrid}>
            {course.instructors.map((instructor, index) => (
              <div key={index} className={styles.instructorCard}>
                <div className={styles.instructorIndex}>{index + 1}</div>
                <div>
                  <h4 className={styles.instructorName}>{instructor.name}</h4>
                  {instructor.designation && (
                    <p className={styles.instructorDesignation}>
                      {instructor.designation}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard")}
            className={styles.cancelBtn}
            disabled={publishing || hasErrors}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/create/content?courseId=${courseId}`)
            }
            className={styles.backBtn}
            disabled={publishing || hasErrors}
          >
            <ArrowLeft size={20} /> Back
          </button>

          <button
            type="button"
            onClick={handlePublish}
            className={styles.publishBtn}
            disabled={publishing || hasErrors}
          >
            {publishing ? (
              <>
                <Loader size={20} className={styles.spinner} /> Publishing...
              </>
            ) : (
              <>
                <CheckCircle size={20} /> Publish Course
              </>
            )}
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
