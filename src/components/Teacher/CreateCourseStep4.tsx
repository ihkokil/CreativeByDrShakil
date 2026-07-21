"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, AlertCircle, Loader } from "lucide-react";
import Image from "next/image";
import styles from "./CreateCourseStep3.module.css";
import { formatDisplayDate } from "@/lib/date-format";

interface CourseData {
  id: string;
  title: string;
  imageUrl?: string;
  price: number;
  salePrice?: number;
  duration: string;
  courseStartDate?: string;
  isFeatured?: boolean;
  overview: string;
  learningOutcomes: string;
  instructors: Array<{ name: string; designation?: string; imageUrl?: string }>;
}

function CreateCourseStep4Content({ courseId }: { courseId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasErrors, setHasErrors] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  useEffect(() => {
    if (!courseId) return;

    const fetchCourse = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/teacher/courses/${courseId}`, {
          headers: getAuthHeaders(),
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
      const response = await fetch(`/api/teacher/courses/${courseId}/publish`, {
        method: "POST",
        body: JSON.stringify({ status: "published" }),
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const publishError = await response.json();
        throw new Error(publishError.error || "Failed to publish");
      }

      router.push("/teacher/dashboard/courses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish course");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading review details...</div>;
  }

  if (!course) {
    return <div className={styles.error}>Course not found</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Review + Publish</h1>
          <p className={styles.subtitle}>Step 4 of 4: Review all details before publishing</p>
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
                  unoptimized
                />
              </div>
            )}

            <div className={styles.overviewInfo}>
              <h3 className={styles.courseTitle}>{course.title}</h3>
              {course.isFeatured && <p className={styles.courseCategory}>Most popular course</p>}

              <div className={styles.courseMeta}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Price:</span>
                  <span className={styles.metaValue}>
                    ৳{course.price}
                    {course.salePrice && <span className={styles.salePrice}> (Sale: ৳{course.salePrice})</span>}
                  </span>
                </div>
                {course.duration && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Duration:</span>
                    <span className={styles.metaValue}>{course.duration}</span>
                  </div>
                )}
                {course.courseStartDate && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Start Date:</span>
                    <span className={styles.metaValue}>
                      {formatDisplayDate(new Date(course.courseStartDate))}
                    </span>
                  </div>
                )}
                {course.instructors && (
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Instructors:</span>
                    <span className={styles.metaValue}>{course.instructors.length}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Course Overview</h2>
          <div className={styles.contentBody}>{course.overview}</div>
        </div>

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

        <div className={styles.contentCard}>
          <h2 className={styles.contentTitle}>Instructors</h2>
          <div className={styles.instructorsGrid}>
            {course.instructors.map((instructor, index) => (
              <div key={index} className={styles.instructorCard} style={{ alignItems: 'center' }}>
                {instructor.imageUrl ? (
                  <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                    <Image src={instructor.imageUrl} alt={instructor.name} fill style={{ objectFit: 'cover' }} unoptimized />
                  </div>
                ) : (
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
                    {instructor.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className={styles.instructorName}>{instructor.name}</h4>
                  {instructor.designation && (
                    <p className={styles.instructorDesignation}>{instructor.designation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/teacher/dashboard/courses")}
            className={styles.cancelBtn}
            disabled={publishing || hasErrors}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(`/teacher/dashboard/courses/${courseId}/outline`)
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

export default function CreateCourseStep4({ courseId }: { courseId?: string }) {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <CreateCourseStep4Content courseId={courseId} />
    </Suspense>
  );
}
