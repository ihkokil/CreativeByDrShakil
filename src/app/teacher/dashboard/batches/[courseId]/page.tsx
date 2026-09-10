"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../batches.module.css";
import Loader from "@/components/UI/Loader";
import { Layers, Calendar, ArrowLeft, Plus, Users, ArrowRight, Search, Zap, Rocket, CalendarDays, Lock, X, Pencil, Trash2 } from "lucide-react";
import { formatDateGMT6, formatDateInputGMT6 } from "@/lib/date-format";
import { motion, AnimatePresence } from "framer-motion";
import { useModalLock } from "@/hooks/useModalLock";

interface Batch {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  createdAt?: string | null;
  studentCount: number;
}

export default function CourseBatchesPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courseTitle, setCourseTitle] = useState("");
  const [isLinear, setIsLinear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "students" | "name">("date");

  // Create Batch Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBatchName, setNewBatchName] = useState("");
  const [newBatchStartDate, setNewBatchStartDate] = useState(() => formatDateInputGMT6(new Date()));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Batch Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [editBatchName, setEditBatchName] = useState("");
  const [editBatchStartDate, setEditBatchStartDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Batch Modal state
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  useModalLock(isModalOpen || isEditModalOpen || Boolean(batchToDelete), () => {
    setIsModalOpen(false);
    setIsEditModalOpen(false);
    setBatchToDelete(null);
  });

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
      setIsLinear(Boolean(data.isLinear));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLinear) {
      alert("Linear courses only support Start Today Batch and All Unlocked Batch. Creating new batches is disabled.");
      return;
    }
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

  const openEditModal = (batch: Batch, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingBatch(batch);
    setEditBatchName(batch.name);
    setEditBatchStartDate(batch.startDate ? formatDateInputGMT6(batch.startDate) : formatDateInputGMT6(new Date()));
    setIsEditModalOpen(true);
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatch) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/teacher/batches/${courseId}/${editingBatch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editBatchName,
          startDate: editBatchStartDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update batch");

      setIsEditModalOpen(false);
      setEditingBatch(null);
      fetchBatches();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteModal = (batch: Batch, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (batch.studentCount > 0) {
      alert(`Cannot delete batch "${batch.name}" because it currently has ${batch.studentCount} enrolled student(s). Please transfer or unenroll students first.`);
      return;
    }
    setBatchToDelete(batch);
  };

  const handleDeleteBatch = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/teacher/batches/${courseId}/${batchToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete batch");

      setBatchToDelete(null);
      fetchBatches();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalStudents = useMemo(() => {
    return batches.reduce((acc, b) => acc + (b.studentCount || 0), 0);
  }, [batches]);

  const getBatchPriority = (name: string) => {
    const n = (name || '').toLowerCase();
    if (n.includes('start today') || n.includes('custom')) return 0;
    if (n.includes('all unlocked') || n.includes('instant')) return 1;
    return 2;
  };

  const filteredAndSortedBatches = useMemo(() => {
    return batches
      .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        const pA = getBatchPriority(a.name);
        const pB = getBatchPriority(b.name);
        // Start Today and All Unlocked always stay pinned at the top
        if (pA !== pB) return pA - pB;
        
        if (sortBy === "students") return b.studentCount - a.studentCount;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        
        // Default: date added descending
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.startDate ? new Date(a.startDate).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.startDate ? new Date(b.startDate).getTime() : 0);
        return timeB - timeA;
      });
  }, [batches, searchQuery, sortBy]);

  const getBatchType = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('start today') || n.includes('custom')) return 'start_today';
    if (n.includes('all unlocked') || n.includes('instant')) return 'all_unlocked';
    return 'scheduled';
  };

  if (loading) return <Loader text="Loading course batches..." />;
  if (error) return <div className={styles.emptyBox}><div className={styles.emptyTitle}>Error: {error}</div></div>;

  return (
    <div className={styles.container}>
      {/* Hero Header */}
      <section className={styles.heroHeader}>
        <div className={styles.breadcrumb}>
          <Link href="/teacher/dashboard/batches" className={styles.breadcrumbLink}>
            Course Batches
          </Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{courseTitle}</span>
        </div>

        <div className={styles.heroContent}>
          <div>
            <h1 className={styles.pageTitle}>
              <Layers size={28} className="text-primary" />
              {courseTitle} — Batches
            </h1>
            <p className={styles.pageSubtitle}>
              {isLinear 
                ? "Linear Course: Students can be enrolled into Start Today Batch (custom enrollment start date) or All Unlocked Batch."
                : "Manage scheduled cohorts, Start Today self-paced enrollments, and instant unlock access for this course."}
            </p>
          </div>

          {!isLinear ? (
            <button 
              type="button"
              className={styles.primaryActionBtn}
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={18} /> New Batch
            </button>
          ) : (
            <div className={styles.modeBadge} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}>
              <Lock size={14} /> Linear Course (Start Today & All Unlocked Only)
            </div>
          )}
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.kpiIconBlue}`}>
              <Layers size={20} />
            </div>
            <div>
              <div className={styles.kpiVal}>{batches.length}</div>
              <div className={styles.kpiLab}>Total Batches</div>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.kpiIconEmerald}`}>
              <Users size={20} />
            </div>
            <div>
              <div className={styles.kpiVal}>{totalStudents}</div>
              <div className={styles.kpiLab}>Enrolled Students</div>
            </div>
          </div>
        </div>
      </section>

      {/* Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search batches..." 
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
            <option value="date">Sort by Date Added (Newest First)</option>
            <option value="students">Sort by Most Students</option>
            <option value="name">Sort by Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Batches Cards Grid */}
      <div className={styles.cardsGrid}>
        {filteredAndSortedBatches.length === 0 ? (
          <div className={styles.emptyBox} style={{ gridColumn: '1 / -1' }}>
            <Layers size={48} style={{ opacity: 0.3 }} />
            <div className={styles.emptyTitle}>No batches found</div>
            <p style={{ margin: 0 }}>Try adjusting your search criteria</p>
          </div>
        ) : (
          filteredAndSortedBatches.map((batch) => {
            const batchType = getBatchType(batch.name);
            const isStartToday = batchType === 'start_today';
            const isAllUnlocked = batchType === 'all_unlocked';

            let cardClass = styles.batchCardScheduled;
            let iconClass = styles.batchIconScheduled;
            let tagClass = styles.batchTypeScheduled;
            let tagLabel = 'Scheduled Cohort';
            let desc = batch.startDate 
              ? `Starts on ${formatDateGMT6(batch.startDate)}${batch.endDate ? ` • Ends ${formatDateGMT6(batch.endDate)}` : ''}` 
              : 'Fixed calendar schedule cohort.';

            if (isStartToday) {
              cardClass = styles.batchCardStartToday;
              iconClass = styles.batchIconStartToday;
              tagClass = styles.batchTypeStartToday;
              tagLabel = 'Start Today';
              desc = 'Student schedule calculates relative to their exact enrollment start date.';
            } else if (isAllUnlocked) {
              cardClass = styles.batchCardAllUnlocked;
              iconClass = styles.batchIconAllUnlocked;
              tagClass = styles.batchTypeAllUnlocked;
              tagLabel = 'All Unlocked';
              desc = 'All curriculum materials and lessons are unlocked instantly upon enrollment.';
            }

            const canManage = !isStartToday && !isAllUnlocked;

            return (
              <div key={batch.id} className={`${styles.batchCard} ${cardClass}`}>
                {canManage && (
                  <div className={styles.batchCardHeaderActions}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="Edit Batch"
                      aria-label="Edit Batch"
                      onClick={(e) => openEditModal(batch, e)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.actionIconBtnDanger}`}
                      title="Delete Batch"
                      aria-label="Delete Batch"
                      onClick={(e) => openDeleteModal(batch, e)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
                <div>
                  <div className={styles.cardHeader}>
                    <div className={`${styles.courseIconBox} ${iconClass}`}>
                      {isStartToday && <Rocket size={22} />}
                      {isAllUnlocked && <Zap size={22} />}
                      {!isStartToday && !isAllUnlocked && <CalendarDays size={22} />}
                    </div>
                    <div className={styles.cardInfo}>
                      <h3 className={styles.cardTitle} title={batch.name}>
                        {isStartToday ? 'Start Today Batch' : isAllUnlocked ? 'All Unlocked Batch' : batch.name}
                      </h3>
                      <div className={styles.badgesRow}>
                        <span className={`${styles.batchTypeTag} ${tagClass}`}>
                          {tagLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className={styles.batchDescText}>
                    {desc}
                  </p>
                </div>

                <div className={styles.cardStatsGrid}>
                  <div className={styles.cardStatItem}>
                    <Users size={16} className="text-secondary" />
                    <div>
                      <div className={styles.cardStatVal}>{batch.studentCount}</div>
                      <div className={styles.cardStatLab}>Students</div>
                    </div>
                  </div>
                  <div className={styles.cardStatItem}>
                    <Calendar size={16} className="text-primary" />
                    <div>
                      <div className={styles.cardStatVal}>
                        {batch.startDate ? formatDateGMT6(batch.startDate) : (isStartToday ? "Enrollment Date" : "Instant Access")}
                      </div>
                      <div className={styles.cardStatLab}>{batch.startDate ? "Starts" : "Mode"}</div>
                    </div>
                  </div>
                </div>

                <Link href={`/teacher/dashboard/batches/${courseId}/${batch.id}`} className={styles.cardActionLink}>
                  View Students ({batch.studentCount})
                  <ArrowRight size={16} />
                </Link>
              </div>
            );
          })
        )}
      </div>

      {/* Create Batch Slide-Over Drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <div className={styles.drawerOverlay} data-drawer="true" onClick={() => setIsModalOpen(false)}>
            <motion.div 
              className={styles.drawerContent}
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Create New Batch</h3>
                  <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>
                    Add a new scheduled cohort for <strong>{courseTitle}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Close drawer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Batch Name</label>
                  <input 
                    type="text" 
                    value={newBatchName} 
                    onChange={(e) => setNewBatchName(e.target.value)} 
                    placeholder="e.g. Batch #73 or Fall 2026"
                    className={styles.formInput}
                    required 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Start Date</label>
                  <input 
                    type="date" 
                    value={newBatchStartDate} 
                    onChange={(e) => setNewBatchStartDate(e.target.value)} 
                    className={styles.formInput}
                    required 
                  />
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  💡 The end date will automatically be set to 1 year from the start date. Students enrolled in this batch will adhere to the batch start schedule.
                </p>

                <div className={styles.modalActions} style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <button type="button" onClick={() => setIsModalOpen(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className={styles.primaryActionBtn}>
                    {isSubmitting ? "Creating..." : "Create Batch"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Batch Slide-Over Drawer */}
      <AnimatePresence>
        {isEditModalOpen && editingBatch && (
          <div className={styles.drawerOverlay} data-drawer="true" onClick={() => setIsEditModalOpen(false)}>
            <motion.div 
              className={styles.drawerContent}
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Edit Batch</h3>
                  <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>
                    Update details for <strong>{editingBatch.name}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={() => setIsEditModalOpen(false)}
                  aria-label="Close drawer"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Batch Name</label>
                  <input 
                    type="text" 
                    value={editBatchName} 
                    onChange={(e) => setEditBatchName(e.target.value)} 
                    placeholder="e.g. Batch #73"
                    className={styles.formInput}
                    required 
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Start Date</label>
                  <input 
                    type="date" 
                    value={editBatchStartDate} 
                    onChange={(e) => setEditBatchStartDate(e.target.value)} 
                    className={styles.formInput}
                    required 
                  />
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  💡 Modifying the start date will recalculate the circular release schedule for students enrolled in this batch.
                </p>

                <div className={styles.modalActions} style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={isUpdating} className={styles.primaryActionBtn}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Batch Confirmation Modal */}
      <AnimatePresence>
        {batchToDelete && (
          <div className={styles.drawerOverlay} data-drawer="true" onClick={() => setBatchToDelete(null)}>
            <motion.div 
              className={styles.drawerContent}
              style={{ maxWidth: 440 }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHeader}>
                <div>
                  <h3 className={styles.modalTitle} style={{ color: '#ef4444' }}>Delete Batch</h3>
                  <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>
                    Are you sure you want to delete <strong>{batchToDelete.name}</strong>?
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.drawerCloseBtn}
                  onClick={() => setBatchToDelete(null)}
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '8px 0', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                This batch will be permanently removed. This action cannot be undone.
              </div>

              <div className={styles.modalActions} style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
                <button type="button" onClick={() => setBatchToDelete(null)} className={styles.cancelBtn}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  disabled={isDeleting} 
                  onClick={handleDeleteBatch}
                  className={styles.primaryActionBtn}
                  style={{ background: '#ef4444', borderColor: '#ef4444' }}
                >
                  {isDeleting ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
