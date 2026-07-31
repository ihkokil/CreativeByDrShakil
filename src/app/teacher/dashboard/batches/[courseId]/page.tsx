"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "../../TeacherDashboard.module.css";
import Loader from "@/components/UI/Loader";
import { Layers, Calendar, ArrowLeft, Plus, Users, ArrowRight, Search, List, Grid } from "lucide-react";
import { formatDateGMT6, formatDateInputGMT6 } from "@/lib/date-format";
import { motion, AnimatePresence } from "framer-motion";
import { useModalLock } from "@/hooks/useModalLock";

interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  studentCount: number;
}

export default function CourseBatchesPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date" | "students">("date");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchStartDate, setNewBatchStartDate] = useState(() => formatDateInputGMT6(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useModalLock(isModalOpen, () => setIsModalOpen(false));

  useEffect(() => {
    fetchBatches();
  }, [courseId]);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/batches/${courseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch batches");
      
      setBatches(data.batches || []);
      setCourseTitle(data.course?.title || "Course Batches");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch(`/api/teacher/batches/${courseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBatchName,
          startDate: newBatchStartDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create batch");
      
      setIsModalOpen(false);
      setNewBatchName("");
      setNewBatchStartDate(formatDateInputGMT6(new Date()));
      fetchBatches();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <Loader text="Loading batches..." />;
  if (error) return <div className={styles.error}>{error}</div>;

  const filteredAndSortedBatches = batches
    .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "students") return b.studentCount - a.studentCount;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader} style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link href="/teacher/dashboard/batches" className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Courses
          </Link>
          <h2 className={styles.sectionTitle}>{courseTitle} - Batches</h2>
          <p className={styles.subtitle}>Manage batches for this course</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.searchBox} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search batches..." 
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
            <option value="date">Sort by Start Date</option>
            <option value="name">Sort by Name</option>
            <option value="students">Sort by Students</option>
          </select>
          
          <div style={{ display: 'flex', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
             <button onClick={() => setViewMode("list")} style={{ padding: '8px', background: viewMode === "list" ? 'var(--primary)' : 'transparent', border: 'none', color: viewMode === "list" ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
                <List size={18} />
             </button>
             <button onClick={() => setViewMode("grid")} style={{ padding: '8px', background: viewMode === "grid" ? 'var(--primary)' : 'transparent', border: 'none', color: viewMode === "grid" ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}>
                <Grid size={18} />
             </button>
          </div>

          <button 
            className={styles.primaryBtn}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} /> New Batch
          </button>
        </div>
      </div>

      <div className={viewMode === "grid" ? styles.coursesGrid : styles.coursesList} style={viewMode === "list" ? { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' } : undefined}>
        {filteredAndSortedBatches.length === 0 ? (
          <div className={styles.emptyState}>No batches found for this course.</div>
        ) : (
          filteredAndSortedBatches.map((batch) => (
            <div key={batch.id} className={`${styles.courseCard} glass`} style={viewMode === "list" ? { flexDirection: 'row', alignItems: 'center', padding: '16px 20px', gap: '20px', justifyContent: 'space-between' } : undefined}>
              <div className={styles.courseHeader} style={viewMode === "list" ? { margin: 0, flex: 1.5 } : undefined}>
                <div className={styles.courseIcon} style={viewMode === "list" ? { width: '40px', height: '40px' } : undefined}>
                  <Layers size={viewMode === "list" ? 20 : 24} />
                </div>
                <div className={styles.courseInfo}>
                  <div style={viewMode === "list" ? { display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                    <h3 style={viewMode === "list" ? { fontSize: '1.1rem', margin: 0 } : undefined}>{batch.name}</h3>
                    {viewMode === "list" && (
                       <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ends: {formatDateGMT6(batch.endDate)}</span>
                    )}
                  </div>
                  {viewMode === "grid" && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Ends: {formatDateGMT6(batch.endDate)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.statsGrid} style={viewMode === "list" ? { display: 'flex', justifyContent: 'space-around', flex: 2, margin: 0, padding: 0, border: 'none', background: 'transparent' } : undefined}>
                <div className={styles.statBox} style={viewMode === "list" ? { border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                  <Calendar size={viewMode === "list" ? 16 : 18} className="text-primary" />
                  <div className={styles.statInfo} style={viewMode === "list" ? { display: 'flex', alignItems: 'baseline', gap: '8px' } : undefined}>
                    <span className={styles.statValue} style={viewMode === "list" ? { fontSize: '1.1rem', margin: 0 } : undefined}>{formatDateGMT6(batch.startDate)}</span>
                    <span className={styles.statLabel} style={viewMode === "list" ? { fontSize: '0.85rem', margin: 0 } : undefined}>Starts</span>
                  </div>
                </div>
                <div className={styles.statBox} style={viewMode === "list" ? { border: 'none', background: 'transparent', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' } : undefined}>
                  <Users size={viewMode === "list" ? 16 : 18} className="text-secondary" />
                  <div className={styles.statInfo} style={viewMode === "list" ? { display: 'flex', alignItems: 'baseline', gap: '8px' } : undefined}>
                    <span className={styles.statValue} style={viewMode === "list" ? { fontSize: '1.1rem', margin: 0 } : undefined}>{batch.studentCount}</span>
                    <span className={styles.statLabel} style={viewMode === "list" ? { fontSize: '0.85rem', margin: 0 } : undefined}>Students</span>
                  </div>
                </div>
              </div>

              {viewMode === "grid" && (
                  <div style={{ padding: '0 1rem 1rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Ends: {formatDateGMT6(batch.endDate)}
                  </div>
              )}

              <div className={styles.courseActions} style={viewMode === "list" ? { flex: 0.5, display: 'flex', justifyContent: 'flex-end', borderTop: 'none', margin: 0, padding: 0 } : undefined}>
                <Link href={`/teacher/dashboard/batches/${courseId}/${batch.id}`} className={styles.primaryBtn} style={viewMode === "list" ? { padding: '8px 16px', fontSize: '0.9rem' } : undefined}>
                  View Students
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className={styles.modalOverlay}>
            <motion.div 
              className={`${styles.modal} glass`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Create New Batch</h3>
              <form onSubmit={handleCreateBatch} className={styles.modalForm}>
                <div className={styles.formGroup}>
                  <label>Batch Name</label>
                  <input 
                    type="text" 
                    value={newBatchName} 
                    onChange={(e) => setNewBatchName(e.target.value)} 
                    placeholder="e.g. Fall 2026 Batch"
                    required 
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Start Date</label>
                  <input 
                    type="date" 
                    value={newBatchStartDate} 
                    onChange={(e) => setNewBatchStartDate(e.target.value)} 
                    required 
                  />
                </div>
                <p className={styles.helpText}>
                  The end date will automatically be set to 1 year from the start date.
                </p>
                <div className={styles.modalActions}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className={styles.primaryBtn}>
                    {isSubmitting ? "Creating..." : "Create Batch"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
