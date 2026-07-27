"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "../../TeacherDashboard.module.css";
import Loader from "@/components/UI/Loader";
import { Layers, Calendar, ArrowLeft, Plus, Users, ArrowRight } from "lucide-react";
import { formatDateGMT6, formatDateInputGMT6 } from "@/lib/date-format";
import { motion, AnimatePresence } from "framer-motion";

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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchStartDate, setNewBatchStartDate] = useState(() => formatDateInputGMT6(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader}>
        <div>
          <Link href="/teacher/dashboard/batches" className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Courses
          </Link>
          <h2 className={styles.sectionTitle}>{courseTitle} - Batches</h2>
          <p className={styles.subtitle}>Manage batches for this course</p>
        </div>
        <button 
          className={styles.primaryBtn}
          onClick={() => setIsModalOpen(true)}
        >
          <Plus size={18} /> New Batch
        </button>
      </div>

      <div className={styles.coursesGrid}>
        {batches.length === 0 ? (
          <div className={styles.emptyState}>No batches found for this course.</div>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} className={`${styles.courseCard} glass`}>
              <div className={styles.courseHeader}>
                <div className={styles.courseIcon}>
                  <Layers size={24} />
                </div>
                <div className={styles.courseInfo}>
                  <h3>{batch.name}</h3>
                </div>
              </div>
              
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <Calendar size={18} className="text-primary" />
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{formatDateGMT6(batch.startDate)}</span>
                    <span className={styles.statLabel}>Starts</span>
                  </div>
                </div>
                <div className={styles.statBox}>
                  <Users size={18} className="text-secondary" />
                  <div className={styles.statInfo}>
                    <span className={styles.statValue}>{batch.studentCount}</span>
                    <span className={styles.statLabel}>Students</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 1rem 1rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Ends: {formatDateGMT6(batch.endDate)}
              </div>

              <div className={styles.courseActions}>
                <Link href={`/teacher/dashboard/batches/${courseId}/${batch.id}`} className={styles.primaryBtn}>
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
          <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
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
