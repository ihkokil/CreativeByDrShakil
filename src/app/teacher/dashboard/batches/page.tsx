"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../TeacherDashboard.module.css";
import Loader from "@/components/UI/Loader";
import { BookOpen, Layers, Calendar, ArrowRight } from "lucide-react";
import { formatDateGMT6 } from "@/lib/date-format";

interface CourseBatchData {
  id: string;
  title: string;
  slug: string;
  status: string;
  totalBatches: number;
  latestBatchDate: string | null;
}

export default function BatchesPage() {
  const [courses, setCourses] = useState<CourseBatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBatchesData();
  }, []);

  const fetchBatchesData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher/batches");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch batches");
      setCourses(data.courses || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader text="Loading batches..." />;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Course Batches</h2>
          <p className={styles.subtitle}>Manage student batches and enrollments per course</p>
        </div>
      </div>

      <div className={styles.coursesGrid}>
        {courses.length === 0 ? (
          <div className={styles.emptyState}>No courses found.</div>
        ) : (
          courses.map((course) => (
            <div key={course.id} className={`${styles.courseCard} glass`}>
              <div className={styles.courseHeader}>
                <div className={styles.courseIcon}>
                  <BookOpen size={24} />
                </div>
                <div className={styles.courseInfo}>
                  <h3>{course.title}</h3>
                  <span className={`${styles.statusBadge} ${styles[course.status]}`}>
                    {course.status}
                  </span>
                </div>
              </div>
              
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <Layers size={18} className="text-primary" />
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{course.totalBatches}</span>
                    <span className={styles.statLabel}>Total Batches</span>
                  </div>
                </div>
                <div className={styles.statBox}>
                  <Calendar size={18} className="text-secondary" />
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>
                      {course.latestBatchDate ? formatDateGMT6(course.latestBatchDate) : "None"}
                    </span>
                    <span className={styles.statLabel}>Latest Batch</span>
                  </div>
                </div>
              </div>

              <div className={styles.courseActions}>
                <Link href={`/teacher/dashboard/batches/${course.id}`} className={styles.primaryBtn}>
                  View Batches
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
