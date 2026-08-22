"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../batches.module.css";
import Loader from "@/components/UI/Loader";
import { ArrowLeft, UserPlus, Users, Calendar, Trash2, Search, Rocket, Zap, CalendarDays, Mail, Phone } from "lucide-react";
import { formatDateGMT6 } from "@/lib/date-format";
import EnrollStudentModal from "@/components/Teacher/EnrollStudentModal";

interface Student {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  orderId: string;
  enrolledAt: string;
}

export default function BatchStudentsPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const batchId = params.batchId as string;
  
  const [students, setStudents] = useState<Student[]>([]);
  const [batchInfo, setBatchInfo] = useState<any>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);

  useEffect(() => {
    fetchBatchStudents();
  }, [courseId, batchId]);

  const fetchBatchStudents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/teacher/batches/${courseId}/${batchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch batch students");
      
      setBatchInfo(data.batch);
      setCourseTitle(data.course?.title || "Course");
      setStudents(data.students || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudent = async (orderId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove ${studentName} from this batch?`)) return;

    try {
      const res = await fetch('/api/teacher/enrollments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        fetchBatchStudents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove student.');
      }
    } catch {
      alert('Network error while removing student.');
    }
  };

  const batchName = batchInfo?.name || "";
  const nameLower = batchName.toLowerCase();
  const isStartToday = nameLower.includes('start today') || nameLower.includes('custom');
  const isAllUnlocked = nameLower.includes('all unlocked') || nameLower.includes('instant');

  const displayBatchTitle = isStartToday 
    ? 'Start Today Batch' 
    : isAllUnlocked 
    ? 'All Unlocked Batch' 
    : batchName;

  const filteredAndSortedStudents = useMemo(() => {
    return students
      .filter(s => 
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.phone && s.phone.includes(searchQuery))
      )
      .sort((a, b) => {
        if (sortBy === "name") return a.fullName.localeCompare(b.fullName);
        return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
      });
  }, [students, searchQuery, sortBy]);

  if (loading) return <Loader text="Loading batch students..." />;
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
          <Link href={`/teacher/dashboard/batches/${courseId}`} className={styles.breadcrumbLink}>
            {courseTitle}
          </Link>
          <span>/</span>
          <span className={styles.breadcrumbCurrent}>{displayBatchTitle}</span>
        </div>

        <div className={styles.heroContent}>
          <div>
            <h1 className={styles.pageTitle}>
              {isStartToday && <Rocket size={26} className="text-primary" />}
              {isAllUnlocked && <Zap size={26} className="text-secondary" />}
              {!isStartToday && !isAllUnlocked && <CalendarDays size={26} className="text-primary" />}
              {displayBatchTitle}
            </h1>
            <p className={styles.pageSubtitle}>
              {isStartToday && "Students in this batch start their learning schedule from their enrollment date."}
              {isAllUnlocked && "Students in this batch have instant, unrestricted access to all course modules."}
              {!isStartToday && !isAllUnlocked && (
                batchInfo?.startDate 
                  ? `Scheduled cohort starting on ${formatDateGMT6(batchInfo.startDate)}${batchInfo.endDate ? ` and ending ${formatDateGMT6(batchInfo.endDate)}` : ''}.`
                  : `Fixed calendar cohort for ${courseTitle}.`
              )}
            </p>
          </div>

          <button 
            type="button"
            className={styles.primaryActionBtn}
            onClick={() => setIsEnrollModalOpen(true)}
          >
            <UserPlus size={18} /> Add Student
          </button>
        </div>

        <div className={styles.kpiGrid}>
          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.kpiIconEmerald}`}>
              <Users size={20} />
            </div>
            <div>
              <div className={styles.kpiVal}>{students.length}</div>
              <div className={styles.kpiLab}>Enrolled Students</div>
            </div>
          </div>

          <div className={styles.kpiCard}>
            <div className={`${styles.kpiIconBox} ${styles.kpiIconBlue}`}>
              <Calendar size={20} />
            </div>
            <div>
              <div className={styles.kpiVal}>
                {batchInfo?.startDate ? formatDateGMT6(batchInfo.startDate) : (isStartToday ? "Enrollment Date" : "Instant Access")}
              </div>
              <div className={styles.kpiLab}>{batchInfo?.startDate ? "Start Date" : "Access Mode"}</div>
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
            placeholder="Search students by name, email, or phone..." 
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
            <option value="date">Sort by Enrolled Date</option>
            <option value="name">Sort by Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student Details</th>
              <th>Contact Info</th>
              <th>Enrolled At</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedStudents.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className={styles.emptyBox}>
                    <Users size={44} style={{ opacity: 0.3 }} />
                    <div className={styles.emptyTitle}>No students in this batch</div>
                    <p style={{ margin: 0 }}>Enroll students directly using the button above</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSortedStudents.map((student) => (
                <tr key={student.orderId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div className={styles.studentAvatar}>
                        {student.fullName?.charAt(0).toUpperCase() || "S"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{student.fullName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: {student.id.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{student.email}</span>
                      </div>
                      {student.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <Phone size={13} />
                          <span>{student.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {formatDateGMT6(student.enrolledAt)}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button 
                      type="button"
                      onClick={() => handleRemoveStudent(student.orderId, student.fullName)}
                      className={styles.deleteBtn}
                      title="Remove from batch"
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isEnrollModalOpen && (
        <EnrollStudentModal
          courseId={courseId}
          batchId={batchId}
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          onSuccess={() => {
            setIsEnrollModalOpen(false);
            fetchBatchStudents();
          }}
        />
      )}
    </div>
  );
}
