'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Calendar, Settings, XCircle, Loader2, BookX } from 'lucide-react';
import { motion } from 'framer-motion';
import styles from './StudentEnrollmentDetailsModal.module.css';
import { formatDateGMT6 } from '@/lib/date-format';

interface EnrolledCourse {
  orderId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  enrolledAt: string | null;
  expiresAt: string | null;
}

interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  phone?: string;
  profileImage?: string;
  enrolledCourses: EnrolledCourse[];
}

interface StudentEnrollmentDetailsModalProps {
  student: StudentProfile;
  onClose: () => void;
  onEditDate: (course: EnrolledCourse) => void;
  onEditRules: (course: EnrolledCourse) => void;
  onRevoke: (course: EnrolledCourse) => void;
}

export default function StudentEnrollmentDetailsModal({
  student,
  onClose,
  onEditDate,
  onEditRules,
  onRevoke
}: StudentEnrollmentDetailsModalProps) {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/students/${student.id}/progress`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (res.ok && isMounted && data.progress) {
          setProgressMap(data.progress);
        }
      } catch (err) {
        console.error('Failed to fetch student progress', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (student.enrolledCourses.length > 0) {
      fetchProgress();
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [student.id, student.enrolledCourses.length]);

  const getInitials = (name: string) => {
    return name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modal} 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2>Student Enrollments</h2>
            <p>Manage course access and progress.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.body}>
          <div className={styles.studentProfile}>
            <div className={styles.avatar}>
              {student.profileImage ? (
                <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
              ) : getInitials(student.fullName)}
            </div>
            <div className={styles.profileInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3>{student.fullName}</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-strong)', padding: '2px 8px', borderRadius: '12px' }}>
                  Registered: {formatDateGMT6(student.createdAt)}
                </span>
              </div>
              <p>{student.email}</p>
            </div>
          </div>

          <div className={styles.courseList}>
            {loading ? (
              <div className={styles.loadingState}>
                <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
                Loading progress...
              </div>
            ) : student.enrolledCourses.length === 0 ? (
              <div className={styles.emptyState}>
                <BookX size={48} />
                <h3>No Enrollments</h3>
                <p>This student is not enrolled in any courses.</p>
              </div>
            ) : (
              student.enrolledCourses.map((c) => {
                const progress = progressMap[c.courseId] || 0;
                return (
                  <div key={c.courseId} className={styles.courseCard}>
                    <div className={styles.courseInfo}>
                      <h4 className={styles.courseTitle}>{c.courseTitle}</h4>
                      <p className={styles.courseDate}>
                        Enrolled: {formatDateGMT6(c.enrolledAt)}
                      </p>
                    </div>
                    
                    <div className={styles.progressWrap}>
                      <div className={styles.progressText}>{progress}%</div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => onEditDate(c)} title="Edit Enrollment Date">
                        <Calendar size={14} /> Enrollment Date
                      </button>
                      <button className={styles.actionBtn} onClick={() => onEditRules(c)} title="Module Rules">
                        <Settings size={14} /> Module Rules
                      </button>
                      <button className={`${styles.actionBtn} ${styles.danger}`} onClick={() => onRevoke(c)} title="Remove Access">
                        <XCircle size={14} /> Remove Access
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
