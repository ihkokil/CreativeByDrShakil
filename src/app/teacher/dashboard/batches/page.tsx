"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../TeacherDashboard.module.css";
import Loader from "@/components/UI/Loader";
import { BookOpen, Layers, Calendar, ArrowRight, Search, List, Grid } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "batches" | "date">("name");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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

  const filteredAndSortedCourses = courses
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

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader} style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className={styles.sectionTitle}>Course Batches</h2>
          <p className={styles.subtitle}>Manage student batches and enrollments per course</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className={styles.searchBox} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search courses..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--foreground)' }}
            />
          </div>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--foreground)' }}
          >
            <option value="name">Sort by Name</option>
            <option value="batches">Sort by Batches</option>
            <option value="date">Sort by Latest Date</option>
          </select>
          
          <div style={{ display: 'flex', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
             <button onClick={() => setViewMode("list")} style={{ padding: '8px', background: viewMode === "list" ? 'var(--primary)' : 'transparent', border: 'none', color: viewMode === "list" ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
                <List size={18} />
             </button>
             <button onClick={() => setViewMode("grid")} style={{ padding: '8px', background: viewMode === "grid" ? 'var(--primary)' : 'transparent', border: 'none', color: viewMode === "grid" ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
                <Grid size={18} />
             </button>
          </div>
        </div>
      </div>

      <div className={viewMode === "grid" ? styles.coursesGrid : styles.coursesList} style={viewMode === "list" ? { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' } : undefined}>
        {filteredAndSortedCourses.length === 0 ? (
          <div className={styles.emptyState}>No courses found.</div>
        ) : (
          filteredAndSortedCourses.map((course) => (
            <div key={course.id} className={`${styles.courseCard} glass`} style={viewMode === "list" ? { flexDirection: 'row', alignItems: 'center', padding: '16px 20px', gap: '20px', justifyContent: 'space-between' } : undefined}>
              <div className={styles.courseHeader} style={viewMode === "list" ? { margin: 0, flex: 1.5 } : undefined}>
                <div className={styles.courseIcon} style={viewMode === "list" ? { width: '40px', height: '40px' } : undefined}>
                  <BookOpen size={viewMode === "list" ? 20 : 24} />
                </div>
                <div className={styles.courseInfo}>
                  <div style={viewMode === "list" ? { display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                    <h3 style={viewMode === "list" ? { fontSize: '1.1rem', margin: 0 } : undefined}>{course.title}</h3>
                    {viewMode === "list" && (
                      <span className={`${styles.statusBadge} ${styles[course.status]}`} style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {course.status}
                      </span>
                    )}
                  </div>
                  {viewMode === "grid" && (
                    <span className={`${styles.statusBadge} ${styles[course.status]}`}>
                      {course.status}
                    </span>
                  )}
                </div>
              </div>
              
              <div className={styles.statsGrid} style={viewMode === "list" ? { display: 'flex', justifyContent: 'space-around', flex: 2, margin: 0, padding: 0, border: 'none', background: 'transparent' } : undefined}>
                <div className={styles.statBox} style={viewMode === "list" ? { border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                  <Layers size={viewMode === "list" ? 16 : 18} className="text-primary" />
                  <div className={styles.statInfo} style={viewMode === "list" ? { display: 'flex', alignItems: 'baseline', gap: '8px' } : undefined}>
                    <span className={styles.statValue} style={viewMode === "list" ? { fontSize: '1.1rem', margin: 0 } : undefined}>{course.totalBatches}</span>
                    <span className={styles.statLabel} style={viewMode === "list" ? { fontSize: '0.85rem', margin: 0 } : undefined}>Batches</span>
                  </div>
                </div>
                <div className={styles.statBox} style={viewMode === "list" ? { border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                  <Calendar size={viewMode === "list" ? 16 : 18} className="text-secondary" />
                  <div className={styles.statInfo} style={viewMode === "list" ? { display: 'flex', alignItems: 'baseline', gap: '8px' } : undefined}>
                    <span className={styles.statValue} style={viewMode === "list" ? { fontSize: '1rem', margin: 0 } : undefined}>
                      {course.latestBatchDate ? formatDateGMT6(course.latestBatchDate) : "None"}
                    </span>
                    <span className={styles.statLabel} style={viewMode === "list" ? { fontSize: '0.85rem', margin: 0 } : undefined}>Latest Batch</span>
                  </div>
                </div>
              </div>

              <div className={styles.courseActions} style={viewMode === "list" ? { flex: 0.5, display: 'flex', justifyContent: 'flex-end', borderTop: 'none', margin: 0, padding: 0 } : undefined}>
                <Link href={`/teacher/dashboard/batches/${course.id}`} className={styles.primaryBtn} style={viewMode === "list" ? { padding: '8px 16px', fontSize: '0.9rem' } : undefined}>
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
