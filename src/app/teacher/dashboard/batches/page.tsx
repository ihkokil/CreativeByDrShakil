"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import styles from "./batches.module.css";
import Loader from "@/components/UI/Loader";
import { BookOpen, Layers, Calendar, ArrowRight, Search, List, Grid, CheckCircle2, Sparkles } from "lucide-react";
import { formatDateGMT6 } from "@/lib/date-format";

interface CourseBatchData {
  id: string;
  title: string;
  slug: string;
  status: string;
  totalBatches: number;
  latestBatchDate: string | null;
  releaseMode?: string | null;
}

export default function BatchesPage() {
  const [courses, setCourses] = useState<CourseBatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "batches" | "date">("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const totalBatchesCount = useMemo(() => {
    return courses.reduce((acc, c) => acc + (c.totalBatches || 0), 0);
  }, [courses]);

  const activeCoursesCount = useMemo(() => {
    return courses.filter(c => c.status === 'published').length;
  }, [courses]);

  const filteredAndSortedCourses = useMemo(() => {
    return courses
      .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "batches") return b.totalBatches - a.totalBatches;
        if (sortBy === "date") {
          if (!a.latestBatchDate) return 1;
          if (!b.latestBatchDate) return -1;
          return new Date(b.latestBatchDate).getTime() - new Date(a.latestBatchDate).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [courses, searchQuery, sortBy]);

  if (loading) return <Loader text="Loading course batches..." />;
  if (error) return <div className={styles.emptyBox}><div className={styles.emptyTitle}>Error: {error}</div></div>;

  return (
    <div className={styles.container}>
      {/* KPI Metrics */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconBlue}`}>
            <BookOpen size={20} />
          </div>
          <div>
            <div className={styles.kpiVal}>{courses.length}</div>
            <div className={styles.kpiLab}>Total Courses</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconEmerald}`}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className={styles.kpiVal}>{activeCoursesCount}</div>
            <div className={styles.kpiLab}>Published Courses</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconBox} ${styles.kpiIconPurple}`}>
            <Sparkles size={20} />
          </div>
          <div>
            <div className={styles.kpiVal}>{totalBatchesCount}</div>
            <div className={styles.kpiLab}>Total Batches</div>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search courses..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.actionGroup}>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.selectBox}
          >
            <option value="name">Sort by Name (A-Z)</option>
            <option value="batches">Sort by Most Batches</option>
            <option value="date">Sort by Latest Date</option>
          </select>

          <div className={styles.viewToggle}>
            <button 
              type="button"
              onClick={() => setViewMode("grid")} 
              className={`${styles.toggleBtn} ${viewMode === "grid" ? styles.toggleBtnActive : ""}`}
              title="Grid View"
            >
              <Grid size={16} />
            </button>
            <button 
              type="button"
              onClick={() => setViewMode("list")} 
              className={`${styles.toggleBtn} ${viewMode === "list" ? styles.toggleBtnActive : ""}`}
              title="List View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Courses Grid / List */}
      <div className={viewMode === "grid" ? styles.cardsGrid : styles.cardsList}>
        {filteredAndSortedCourses.length === 0 ? (
          <div className={styles.emptyBox} style={{ gridColumn: '1 / -1' }}>
            <Layers size={48} style={{ opacity: 0.3 }} />
            <div className={styles.emptyTitle}>No courses found</div>
            <p style={{ margin: 0 }}>Try adjusting your search criteria</p>
          </div>
        ) : (
          filteredAndSortedCourses.map((course) => (
            <div key={course.id} className={styles.courseCard}>
              <div className={styles.cardHeader}>
                <div className={styles.courseIconBox}>
                  <BookOpen size={22} />
                </div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardTitle} title={course.title}>
                    {course.title}
                  </h3>
                  <div className={styles.badgesRow}>
                    <span className={`${styles.statusBadge} ${course.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                      {course.status}
                    </span>
                    {course.releaseMode && (
                      <span className={styles.modeBadge}>
                        {course.releaseMode === 'circular' ? 'Circular Schedule' : 'Linear Schedule'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.cardStatsGrid}>
                <div className={styles.cardStatItem}>
                  <Layers size={16} className="text-primary" />
                  <div>
                    <div className={styles.cardStatVal}>{course.totalBatches}</div>
                    <div className={styles.cardStatLab}>Batches</div>
                  </div>
                </div>
                <div className={styles.cardStatItem}>
                  <Calendar size={16} className="text-secondary" />
                  <div>
                    <div className={styles.cardStatVal}>
                      {course.latestBatchDate ? formatDateGMT6(course.latestBatchDate) : "Dynamic"}
                    </div>
                    <div className={styles.cardStatLab}>Latest Batch</div>
                  </div>
                </div>
              </div>

              <Link href={`/teacher/dashboard/batches/${course.id}`} className={styles.cardActionLink}>
                Manage Batches
                <ArrowRight size={16} />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
