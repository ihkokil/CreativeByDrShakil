"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../../../TeacherDashboard.module.css";
import Loader from "@/components/UI/Loader";
import { ArrowLeft, UserPlus, Users, Calendar, Trash2, Search } from "lucide-react";
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
    } catch (err) {
      alert('Network error while removing student.');
    }
  };

  if (loading) return <Loader text="Loading students..." />;
  if (error) return <div className={styles.error}>{error}</div>;

  const filteredAndSortedStudents = students
    .filter(s => s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || s.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.fullName.localeCompare(b.fullName);
      return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
    });

  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeader} style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Link href={`/teacher/dashboard/batches/${courseId}`} className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Batches
          </Link>
          <h2 className={styles.sectionTitle}>{batchInfo?.name} - Students</h2>
          <p className={styles.subtitle}>Manage enrollments for this specific batch</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.searchBox} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search students..." 
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
            <option value="date">Sort by Enrolled Date</option>
            <option value="name">Sort by Name</option>
          </select>

          <button 
            className={styles.primaryBtn}
            onClick={() => setIsEnrollModalOpen(true)}
          >
            <UserPlus size={18} /> Add Student
          </button>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student</th>
              <th>Enrolled At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedStudents.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", padding: "2rem" }}>
                  No students found.
                </td>
              </tr>
            ) : (
              filteredAndSortedStudents.map((student) => (
                <tr key={student.orderId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {student.fullName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{student.fullName}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{student.email}</div>
                        {student.phone && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{student.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{formatDateGMT6(student.enrolledAt)}</td>
                  <td>
                    <button 
                      onClick={() => handleRemoveStudent(student.orderId, student.fullName)}
                      style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '0.5rem', borderRadius: '4px' }}
                      title="Remove Student"
                    >
                      <Trash2 size={18} />
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
    </section>
  );
}
