'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Calendar, Settings, XCircle, BookX, ChevronDown, Users } from 'lucide-react';
import Loader from "@/components/UI/Loader";
import { motion, AnimatePresence } from 'framer-motion';
import styles from './StudentEnrollmentDetailsModal.module.css';
import { formatDateGMT6 } from '@/lib/date-format';
import { useModal } from '@/hooks/useModal';

export interface EnrolledCourse {
  orderId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  imageUrl?: string | null;
  enrolledAt: string | null;
  expiresAt: string | null;
  batchId?: string | null;
  batchName?: string | null;
  batchStartDate?: string | null;
  completedCount?: number;
  totalCount?: number;
  progressPercent?: number;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
  phone?: string;
  bmdcNumber?: string | null;
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
  const [studentData, setStudentData] = useState<StudentProfile>(student);
  const [coursesList, setCoursesList] = useState<EnrolledCourse[]>(student.enrolledCourses || []);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [avgProgress, setAvgProgress] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(defaultExpandedCourseId || null);

  useModal(true, onClose);

  useEffect(() => {
    setStudentData(student);
    setCoursesList(student.enrolledCourses || []);
  }, [student]);

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
        
        if (res.ok && isMounted) {
          if (data.student) {
            setStudentData(prev => ({
              ...prev,
              fullName: data.student.fullName || prev.fullName,
              email: data.student.email || prev.email,
              phone: data.student.phone ?? prev.phone,
              bmdcNumber: data.student.bmdcNumber ?? prev.bmdcNumber,
              profileImage: data.student.profileImage ?? prev.profileImage,
              role: data.student.role || prev.role,
              createdAt: data.student.createdAt || prev.createdAt,
            }));
          }

          if (Array.isArray(data.courses) && data.courses.length > 0) {
            const mappedCourses: EnrolledCourse[] = data.courses.map((c: any) => {
              const existingCourse = student.enrolledCourses?.find(ec => ec.courseId === c.courseId);
              return {
                orderId: c.orderId || existingCourse?.orderId || '',
                courseId: c.courseId,
                courseTitle: c.courseTitle || c.title || existingCourse?.courseTitle || 'Untitled Course',
                courseSlug: c.courseSlug || c.slug || existingCourse?.courseSlug || null,
                imageUrl: c.imageUrl || null,
                enrolledAt: c.enrolledAt || existingCourse?.enrolledAt || null,
                expiresAt: c.expiresAt || existingCourse?.expiresAt || null,
                batchId: c.batchId || existingCourse?.batchId || null,
                batchName: c.batchName || existingCourse?.batchName || null,
                batchStartDate: c.batchStartDate || existingCourse?.batchStartDate || null,
                completedCount: c.completedCount ?? 0,
                totalCount: c.totalCount ?? 0,
                progressPercent: c.progressPercent ?? 0,
              };
            });

            setCoursesList(mappedCourses);

            const pMap: Record<string, number> = {};
            mappedCourses.forEach(c => {
              pMap[c.courseId] = c.progressPercent ?? 0;
            });
            setProgressMap(pMap);

            if (typeof data.avgProgress === 'number') {
              setAvgProgress(data.avgProgress);
            } else if (mappedCourses.length > 0) {
              const totalPct = mappedCourses.reduce((sum, c) => sum + (c.progressPercent ?? 0), 0);
              setAvgProgress(Math.round(totalPct / mappedCourses.length));
            }
          } else if (data.progress) {
            setProgressMap(data.progress);
            if (typeof data.avgProgress === 'number') {
              setAvgProgress(data.avgProgress);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch student progress', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProgress();

    return () => {
      isMounted = false;
    };
  }, [student.id, student.enrolledCourses]);

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const totalCourses = coursesList.length;
  const now = new Date();

  return (
    <div className={styles.overlay} data-drawer="true">
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
            <p>View profile, progress, and manage enrollment access.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close modal"><X size={20} /></button>
        </div>

        <div className={styles.body}>
          {/* Detailed Profile Summary */}
          <div className={styles.profileSummaryCard}>
            <div className={styles.profileHeader}>
              <div className={styles.avatarLarge}>
                {studentData.profileImage ? (
                  <Image src={studentData.profileImage} alt={studentData.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
                ) : getInitials(studentData.fullName)}
              </div>
              <div className={styles.profileHeaderInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h3>{studentData.fullName}</h3>
                  <span className={styles.roleBadge}>{studentData.role || 'Student'}</span>
                </div>
                <span className={styles.registeredDate}>Joined {formatDateGMT6(studentData.createdAt)}</span>
              </div>
            </div>

            <div className={styles.contactGrid}>
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>Email Address</span>
                <span className={styles.contactValue}>{studentData.email}</span>
              </div>
              {studentData.phone && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>Phone Number</span>
                  <span className={styles.contactValue}>{studentData.phone}</span>
                </div>
              )}
              {studentData.bmdcNumber && (
                <div className={styles.contactItem}>
                  <span className={styles.contactLabel}>BM&DC Number</span>
                  <span className={styles.contactValue}>{studentData.bmdcNumber}</span>
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
            <h3>Enrolled Programs ({totalCourses})</h3>
          </div>

          <div className={styles.courseList}>
            {loading && coursesList.length === 0 ? (
              <div className={styles.loadingState}>
                <Loader variant="inline" text="Loading enrollment data..." />
                Loading enrolled programs...
              </div>
            ) : coursesList.length === 0 ? (
              <div className={styles.emptyState}>
                <BookX size={48} />
                <h3>No Enrollments</h3>
                <p>This student is not enrolled in any courses.</p>
              </div>
            ) : (
              coursesList.map((c) => {
                const progress = progressMap[c.courseId] ?? c.progressPercent ?? 0;
                const isExpanded = expandedCourseId === c.courseId;

                let isExpired = false;
                if (c.expiresAt) {
                  const expDate = new Date(c.expiresAt);
                  if (expDate.getTime() < now.getTime()) isExpired = true;
                }

                return (
                  <div key={c.courseId} className={styles.courseCard}>
                    <div 
                      className={`${styles.courseHeader} ${isExpanded ? styles.expanded : ''}`}
                      onClick={() => setExpandedCourseId(isExpanded ? null : c.courseId)}
                    >
                      <div className={styles.courseInfo}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 className={styles.courseTitle}>{c.courseTitle}</h4>
                          {c.batchName && (
                            <span className={styles.modalBatchTag} title={`Batch: ${c.batchName}`}>
                              <Users size={12} /> {c.batchName}
                            </span>
                          )}
                          {isExpired && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                              Expired
                            </span>
                          )}
                        </div>
                        <p className={styles.courseDate}>
                          <span>Enrolled: {formatDateGMT6(c.enrolledAt)}</span>
                          {c.expiresAt && <span> • Expires: {formatDateGMT6(c.expiresAt)}</span>}
                        </p>
                      </div>
                      
                      <div className={styles.progressWrap}>
                        <div className={styles.progressText}>
                          {progress}%
                          {typeof c.completedCount === 'number' && typeof c.totalCount === 'number' && c.totalCount > 0 && (
                            <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 500, opacity: 0.75 }}>
                              {c.completedCount}/{c.totalCount} done
                            </span>
                          )}
                        </div>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${progress}%`, background: progress === 100 ? 'var(--success, #10b981)' : 'var(--primary)' }} />
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
                              <span className={styles.actionCardDesc}>Manage content availability & drip</span>
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
