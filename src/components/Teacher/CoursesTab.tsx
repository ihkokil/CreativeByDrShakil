"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, Trash2, Edit2, Calendar, Users, Clock } from "lucide-react";
import Image from "next/image";
import styles from "./CoursesTab.module.css";
import { formatDisplayDate } from "@/lib/date-format";

interface CourseInstructor {
  id: string;
  name: string;
  designation?: string;
}

interface Course {
  id: string;
  title: string;
  slug: string;
  price: number;
  salePrice?: number;
  imageUrl?: string;
  status: "draft" | "published" | "scheduled" | "archived";
  duration: string;
  courseStartDate?: string;
  instructors: CourseInstructor[];
  createdAt: string;
  updatedAt: string;
}

export default function CoursesTab() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/teacher/courses", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error("Failed to fetch courses");
      }

      const data = await response.json();
      setCourses(data.courses || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const baseClass = styles.badge;
    if (status === "published") return `${baseClass} ${styles.badgePublished}`;
    if (status === "scheduled") return `${baseClass} ${styles.badgeScheduled}`;
    if (status === "archived") return `${baseClass} ${styles.badgeArchived}`;
    return `${baseClass} ${styles.badgeDraft}`;
  };

  const formatMoney = (value: number) => `৳${value.toLocaleString()}`;

  const handleEditCourse = (courseId: string) => {
    router.push(`/teacher/dashboard/courses/create?courseId=${courseId}`);
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/teacher/courses/${courseId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        setCourses(courses.filter((c) => c.id !== courseId));
      }
    } catch (err) {
      console.error("Failed to delete course:", err);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading courses...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          <BookOpen size={24} />
          Your Courses
        </h2>
        <p className={styles.subtitle}>
          {courses.length === 0
            ? "No courses yet. Create your first course now!"
            : `You have ${courses.length} course${courses.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {courses.length === 0 ? (
        <div className={styles.emptyState}>
          <BookOpen size={48} />
          <h3>No Courses Yet</h3>
          <p>Start creating your first course to engage students</p>
          <button
            className={styles.createBtn}
            onClick={() => router.push("/teacher/dashboard/courses/create")}
          >
            <Plus size={18} />
            Create Your First Course
          </button>
        </div>
      ) : (
        <>
          <div className={styles.courseGrid}>
            {courses.map((course) => (
              <article key={course.id} className={styles.courseCard}>
                <div className={styles.cardImage}>
                  {course.imageUrl ? (
                    <Image
                      src={course.imageUrl}
                      alt={course.title}
                      fill
                      className={styles.image}
                      unoptimized
                    />
                  ) : (
                    <div className={styles.placeholderImage}>
                      <BookOpen size={40} />
                    </div>
                  )}
                  <span className={getStatusBadgeClass(course.status)}>
                    {course.status.charAt(0).toUpperCase() + course.status.slice(1)}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTopRow}>
                    <span className={styles.categoryPill}>{course.status}</span>
                    {course.courseStartDate && (
                      <span className={styles.startDate}>
                        <Calendar size={14} />
                        {formatDisplayDate(course.courseStartDate)}
                      </span>
                    )}
                  </div>

                  <h3 className={styles.courseTitle}>{course.title}</h3>

                  <div className={styles.courseMeta}>
                    <span className={styles.metaItem}>
                      <Clock size={14} /> Duration <strong>{course.duration}</strong>
                    </span>
                    {course.instructors.length > 0 && (
                      <span className={styles.metaItem}>
                        <Users size={14} /> Instructors <strong>{course.instructors.length}</strong>
                      </span>
                    )}
                  </div>

                  <div className={styles.pricingRow}>
                    <div>
                      <span className={styles.priceLabel}>Price</span>
                      <div className={styles.priceDisplay}>
                        {course.salePrice ? (
                          <>
                            <span className={styles.salePrice}>{formatMoney(course.salePrice)}</span>
                            <span className={styles.originalPrice}>{formatMoney(course.price)}</span>
                          </>
                        ) : (
                          <span className={styles.price}>{formatMoney(course.price)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => handleEditCourse(course.id)}
                      title="Edit course"
                    >
                      <Edit2 size={16} />
                      Edit
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDeleteCourse(course.id)}
                      title="Delete course"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            className={styles.addCourseBtn}
            onClick={() => router.push("/teacher/dashboard/courses/create")}
          >
            <Plus size={18} />
            Add New Course
          </button>
        </>
      )}
    </div>
  );
}
