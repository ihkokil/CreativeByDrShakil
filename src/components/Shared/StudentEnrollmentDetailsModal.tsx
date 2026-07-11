'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Calendar, Settings, XCircle, Loader2, BookX, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  defaultExpandedCourseId?: string | null;
  onClose: () => void;
  onEditDate: (course: EnrolledCourse) => void;
  onEditRules: (course: EnrolledCourse) => void;
  onRevoke: (course: EnrolledCourse) => void;
}

export default function StudentEnrollmentDetailsModal({
  student,
  defaultExpandedCourseId,
  onClose,
  onEditDate,
  onEditRules,
  onRevoke
}: StudentEnrollmentDetailsModalProps) {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(defaultExpandedCourseId || null);

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
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const totalCourses = student.enrolledCourses.length;
  const totalProgressMapValues = Object.values(progressMap);
  const avgProgress = totalCourses > 0 && totalProgressMapValues.length > 0
    ? Math.round(totalProgressMapValues.reduce((a, b) => a + b, 0) / totalProgressMapValues.length)
    : 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modal} 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <h2>Student Details</h2>
            <p>View profile and manage access.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        <div className={styles.body}>
          {/* Detailed Profile Summary */}
          <div className={styles.profileSummaryCard}>
            <div className={styles.profileHeader}>
              <div className={styles.avatarLarge}>
                {student.profileImage ? (
                  <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
                ) : getInitials(student.fullName)}
              </div>
              <div className={styles.profileHeaderInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3>{student.fullName}</h3>
                  <span className={styles.roleBadge}>{student.role}</span>
                </div>
                <span className={styles.registeredDate}>Joined {formatDateGMT6(student.createdAt)}</span>
              </div>
            </div>

            <div className={styles.contactGrid}>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Email Address</span>
                <span className={styles.contactValue}>{student.email}</span>
              </div>
              {student.phone && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Phone Number</span>
                  <span className={styles.contactValue}>{student.phone}</span>
                </div>
              )}
              {student.bmdcNumber && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>BM&DC Number</span>
                  <span className={styles.contactValue}>{student.bmdcNumber}</span>
                </div>
              )}
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{totalCourses}</span>
                <span className={styles.statLabel}>Enrolled Programs</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statValue}>{avgProgress}%</span>
                <span className={styles.statLabel}>Average Progress</span>
              </div>
            </div>
          </div>

          <div className={styles.courseSectionTitle}>
            <h3>Enrolled Programs</h3>
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
                const isExpanded = expandedCourseId === c.courseId;

                return (
                  <div key={c.courseId} className={styles.courseCard}>
                    <div 
                      className={`${styles.courseHeader} ${isExpanded ? styles.expanded : ''}`}
                      onClick={() => setExpandedCourseId(isExpanded ? null : c.courseId)}
                    >
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

                      <ChevronDown size={20} className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`} />
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={styles.courseActionsWrapper}
                        >
                          <div className={styles.courseActionsPanel}>
                            <div className={styles.actionCard} onClick={() => onEditDate(c)}>
                              <div className={styles.actionCardTitle}>
                                <Calendar size={16} /> Edit Dates
                              </div>
                              <span className={styles.actionCardDesc}>Change start or expiry date</span>
                            </div>
                            
                            <div className={styles.actionCard} onClick={() => onEditRules(c)}>
                              <div className={styles.actionCardTitle}>
                                <Settings size={16} /> Module Rules
                              </div>
                              <span className={styles.actionCardDesc}>Manage content availability</span>
                            </div>
                            
                            <div className={`${styles.actionCard} ${styles.danger}`} onClick={() => onRevoke(c)}>
                              <div className={styles.actionCardTitle}>
                                <XCircle size={16} /> Revoke Access
                              </div>
                              <span className={styles.actionCardDesc}>Remove student from this course</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
