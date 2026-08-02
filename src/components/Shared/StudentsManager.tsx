'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
  Search, Edit, Trash2, GraduationCap, X, 
  User, Mail, Phone, FileText, ImagePlus, Send, Calendar,
  ChevronDown, Filter, Eye, BookPlus, Trash, CalendarClock,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import dashStyles from '@/app/admin/dashboard/AdminDashboard.module.css';
import styles from './StudentsManager.module.css';
import Loader from "@/components/UI/Loader";
import StudentRulesModal from '@/components/Teacher/StudentRulesModal';
import StudentEnrollmentDetailsModal from './StudentEnrollmentDetailsModal';
import SingleCourseProgressModal from './SingleCourseProgressModal';
import AlertModal from '@/components/UI/AlertModal';
import { useModal } from '@/hooks/useModal';
import { formatDateGMT6, formatDateInputGMT6 } from '@/lib/date-format';

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
  bmdcNumber?: string;
  profileImage?: string;

  enrolledCourses: EnrolledCourse[];
}



function CircularProgress({ progress }: { progress: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="16" cy="16" r={radius} stroke="color-mix(in srgb, var(--primary) 15%, transparent)" strokeWidth="3" fill="none" />
        <circle 
          cx="16" cy="16" r={radius} 
          stroke="var(--primary)" 
          strokeWidth="3" 
          fill="none" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          strokeLinecap="round" 
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        {progress}%
      </div>
    </div>
  );
}

function StudentProgramsCell({ student, onCourseClick }: { student: StudentProfile, onCourseClick?: (courseId: string) => void }) {
  if (student.enrolledCourses.length === 0) {
    return <span className={styles.noCoursesPill}>No courses</span>;
  }

  return (
    <div className={styles.courseCards}>
      {student.enrolledCourses.slice(0, 2).map((c) => {
        return (
          <div 
            key={c.courseId} 
            className={styles.courseCard}
            onClick={(e) => {
              e.stopPropagation();
              onCourseClick?.(c.courseId);
            }}
            style={onCourseClick ? { cursor: 'pointer' } : undefined}
          >
            <span className={styles.courseCardTitle} title={c.courseTitle}>{c.courseTitle}</span>
            <div className={styles.courseCardBottom}>
              <div className={styles.courseCardDate}>
                <span>Start: {c.enrolledAt ? formatDateGMT6(c.enrolledAt) : '—'}</span>
                <span>Expires: {c.expiresAt ? formatDateGMT6(c.expiresAt) : '—'}</span>
              </div>
            </div>
          </div>
        );
      })}
      {student.enrolledCourses.length > 2 && (
        <span className={`${styles.coursePill} ${styles.coursePillMore}`}>
          +{student.enrolledCourses.length - 2} more
        </span>
      )}
    </div>
  );
}

export default function StudentsManager() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchCourseId, setBatchCourseId] = useState<string>('');
  const [batchId, setBatchId] = useState<string>('');
  const [courseBatches, setCourseBatches] = useState<any[]>([]);
  const [batchEnrollDate, setBatchEnrollDate] = useState(() => formatDateInputGMT6(new Date()));

  // Fetch batches when selected course changes
  useEffect(() => {
    if (!batchCourseId) {
      setCourseBatches([]);
      setBatchId('');
      return;
    }
    const fetchCourseBatches = async () => {
      try {
        const res = await fetch(`/api/teacher/batches/${batchCourseId}`);
        if (res.ok) {
          const data = await res.json();
          setCourseBatches(data.batches || []);
        }
      } catch (e) {
        console.error("Failed to fetch batches for course", e);
      }
    };
    fetchCourseBatches();
  }, [batchCourseId]);

  // Batch panels
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [showRemovePanel, setShowRemovePanel] = useState(false);
  const [removeCourseId, setRemoveCourseId] = useState('');
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelCourseId, setDatePanelCourseId] = useState('');
  const [datePanelDate, setDatePanelDate] = useState(() => formatDateInputGMT6(new Date()));

  // Edit student enrollments state
  const [editEnrollments, setEditEnrollments] = useState<Record<string, { selected: boolean, date: string, isExisting: boolean }>>({});

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentProfile | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<StudentProfile | null>(null);
  const [autoExpandCourseId, setAutoExpandCourseId] = useState<string | null>(null);
  const [selectedSingleCourse, setSelectedSingleCourse] = useState<{
    student: StudentProfile;
    courseId: string;
    courseTitle: string;
    enrolledAt: string | null;
    expiresAt: string | null;
  } | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<{
    studentName: string;
    courseTitle: string;
    orderId: string;
    enrolledAt: string;
  } | null>(null);
  const [editingRulesFor, setEditingRulesFor] = useState<{
    courseId: string;
    userId?: string;
    userIds?: string[];
    studentName: string;
  } | null>(null);

  // Sync selected single course when students change
  useEffect(() => {
    if (selectedSingleCourse) {
      const updatedStudent = students.find(s => s.id === selectedSingleCourse.student.id);
      if (updatedStudent) {
        const courseEnrollment = updatedStudent.enrolledCourses.find(c => c.courseId === selectedSingleCourse.courseId);
        if (courseEnrollment) {
          if (
            courseEnrollment.enrolledAt !== selectedSingleCourse.enrolledAt ||
            courseEnrollment.expiresAt !== selectedSingleCourse.expiresAt ||
            updatedStudent !== selectedSingleCourse.student
          ) {
            setSelectedSingleCourse({
              student: updatedStudent,
              courseId: selectedSingleCourse.courseId,
              courseTitle: selectedSingleCourse.courseTitle,
              enrolledAt: courseEnrollment.enrolledAt,
              expiresAt: courseEnrollment.expiresAt,
            });
          }
        } else {
          setSelectedSingleCourse(null);
        }
      }
    }
  }, [students]);

  // Form states
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '', 
    bmdcNumber: '', 
    profileImage: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alert Modal state
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, message: '', type: 'info' });

  const showAlert = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string) => {
    setAlertConfig({ isOpen: true, message, type, title });
  };

  useModal(!!editStudent, () => {
    setEditStudent(null);
    setMessage(null);
  });
  useModal(!!deleteStudent, () => setDeleteStudent(null));
  useModal(isAddOpen, () => {
    setIsAddOpen(false);
    setMessage(null);
  });
  useModal(!!editingEnrollment, () => setEditingEnrollment(null));
  useModal(!!selectedStudentForDetails, () => setSelectedStudentForDetails(null));
  useModal(!!selectedSingleCourse, () => setSelectedSingleCourse(null));

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

  const showMessage = (msg: { type: 'success' | 'error'; text: string }) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.students) {
        const sortedStudents = data.students.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setStudents(sortedStudents);
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses/dynamic');
      const data = await res.json();
      if (res.ok && data.courses) {
        setCourses(data.courses);
      }
    } catch (err) {
      console.error('Failed to fetch courses', err);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchCourses();
  }, [fetchStudents, fetchCourses]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, profileImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      const matchesSearch = s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.email?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (courseFilter === 'none') return s.enrolledCourses.length === 0;
      if (courseFilter) {
        const hasCourse = s.enrolledCourses.some(c => c.courseId === courseFilter);
        if (!hasCourse) return false;
      }
      return true;
    });

    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'name_asc':
        result.sort((a, b) => a.fullName.localeCompare(b.fullName));
        break;
      case 'name_desc':
        result.sort((a, b) => b.fullName.localeCompare(a.fullName));
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result;
  }, [students, searchQuery, courseFilter, sortBy]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, courseFilter, sortBy]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize);

  // Checkbox functions
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredStudents.length && filteredStudents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map(s => s.id)));
    }
  };

  // Batch Enrollment Submit (Single course + Batch)
  const handleBatchEnrollSubmit = async () => {
    if (!batchCourseId) {
      showAlert('Please select a course to enroll.', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          studentIds: Array.from(selectedIds),
          courseId: batchCourseId,
          batchId: batchId || undefined,
          enrolledAt: batchEnrollDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert(`Successfully enrolled ${selectedIds.size} student(s) into course!`, 'success', 'Batch Enrollment Complete');
        setSelectedIds(new Set());
        setBatchCourseId('');
        setBatchId('');
        setShowEnrollPanel(false);
        fetchStudents();
      } else {
        showAlert(data.error || 'Failed to enroll students.', 'error');
      }
    } catch (err) {
      showAlert('Network error while processing batch enrollment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch Remove from Course
  const handleBatchRemove = async () => {
    if (!removeCourseId) {
      showAlert('Please select a course to remove students from.', 'warning');
      return;
    }

    const selectedStudentNames = Array.from(selectedIds)
      .map(id => students.find(s => s.id === id)?.fullName)
      .filter(Boolean)
      .join(', ');
    const course = courses.find(c => c.id === removeCourseId);

    if (!confirm(`Remove ${selectedIds.size} student(s) from "${course?.title}"?\n\nStudents: ${selectedStudentNames}`)) return;

    setIsSubmitting(true);
    try {
      let successCount = 0;
      for (const studentId of selectedIds) {
        const student = students.find(s => s.id === studentId);
        const enrollment = student?.enrolledCourses.find(c => c.courseId === removeCourseId);
        if (!enrollment) continue;

        try {
          const res = await fetch('/api/teacher/enrollments', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ orderId: enrollment.orderId }),
          });
          if (res.ok) successCount++;
        } catch {}
      }

      showAlert(`Removed ${successCount} student(s) from "${course?.title}".`, 'success', 'Batch Remove Complete');
      setSelectedIds(new Set());
      setShowRemovePanel(false);
      setRemoveCourseId('');
      fetchStudents();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Batch Edit Enrollment Dates
  const handleBatchDateUpdate = async () => {
    if (!datePanelCourseId || !datePanelDate) {
      showAlert('Please select a course and date.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;
      for (const studentId of selectedIds) {
        const student = students.find(s => s.id === studentId);
        const enrollment = student?.enrolledCourses.find(c => c.courseId === datePanelCourseId);
        if (!enrollment) continue;

        try {
          const res = await fetch('/api/students/update-enrollment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              orderId: enrollment.orderId,
              enrolledAt: datePanelDate,
            }),
          });
          if (res.ok) successCount++;
        } catch {}
      }

      showAlert(`Updated enrollment dates for ${successCount} student(s).`, 'success', 'Batch Date Update Complete');
      setSelectedIds(new Set());
      setShowDatePanel(false);
      setDatePanelCourseId('');
      fetchStudents();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Single Enrollment Date
  const handleSaveEnrollmentDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnrollment) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/students/update-enrollment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId: editingEnrollment.orderId,
          enrolledAt: editingEnrollment.enrolledAt,
        }),
      });

      if (res.ok) {
        setEditingEnrollment(null);
        fetchStudents();
      } else {
        const data = await res.json();
        showAlert(data.error || 'Failed to update enrollment date.', 'error');
      }
    } catch (err) {
      showAlert('Network error while updating enrollment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revoke enrollment
  const handleRevokeEnrollment = async (orderId: string, studentName: string, courseTitle: string) => {
    if (!confirm(`Are you sure you want to revoke ${studentName}'s access to "${courseTitle}"?`)) return;

    try {
      const res = await fetch('/api/teacher/enrollments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderId }),
      });

      if (res.ok) {
        fetchStudents();
      } else {
        const data = await res.json();
        showAlert(data.error || 'Failed to revoke enrollment.', 'error');
      }
    } catch (err) {
      showAlert('Network error while revoking enrollment.', 'error');
    }
  };

  // Student CRUD Handlers
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...token ? { Authorization: `Bearer ${token}` } : {} },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        showMessage({ type: 'success', text: data.message || 'Student added and invitation sent.' });
        setTimeout(() => {
          setIsAddOpen(false);
          setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' });
          fetchStudents();
        }, 2000);
      } else {
        showMessage({ type: 'error', text: data.error || 'Failed to add student.' });
      }
    } catch (err) {
      showMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...token ? { Authorization: `Bearer ${token}` } : {} },
        body: JSON.stringify({ id: editStudent.id, ...formData })
      });
      const data = await res.json();

      if (res.ok) {
        let enrollmentErrors: string[] = [];

        // Process enrollments
        for (const course of courses) {
          const editState = editEnrollments[course.id];
          if (!editState) continue;

          // Enroll newly selected courses
          if (editState.selected && !editState.isExisting) {
            try {
              const resEnroll = await fetch('/api/students', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  studentIds: [editStudent.id],
                  courseId: course.id,
                  enrolledAt: editState.date,
                }),
              });
              if (!resEnroll.ok) {
                enrollmentErrors.push(`Failed to enroll in ${course.title}`);
              }
            } catch (err) {
              enrollmentErrors.push(`Network error for ${course.title}`);
            }
          }
          // Revoke unselected existing courses
          else if (!editState.selected && editState.isExisting) {
            const enrollment = editStudent.enrolledCourses.find(c => c.courseId === course.id);
            if (enrollment) {
              try {
                const resRevoke = await fetch('/api/teacher/enrollments', {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                  body: JSON.stringify({ orderId: enrollment.orderId }),
                });
                if (!resRevoke.ok) {
                  enrollmentErrors.push(`Failed to revoke ${course.title}`);
                }
              } catch (err) {
                enrollmentErrors.push(`Network error for ${course.title}`);
              }
            }
          }
        }

        if (enrollmentErrors.length > 0) {
          showMessage({ type: 'error', text: `Profile updated, but: ${enrollmentErrors.join(', ')}` });
          setTimeout(() => {
            setEditStudent(null);
            fetchStudents();
          }, 3000);
        } else {
          showMessage({ type: 'success', text: 'Student profile and enrollments updated successfully.' });
          setTimeout(() => {
            setEditStudent(null);
            fetchStudents();
          }, 1500);
        }
      } else {
        showMessage({ type: 'error', text: data.error || 'Failed to update student.' });
      }
    } catch (err) {
      showMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setIsSubmitting(true);
    try {
      await fetch('/api/admin/students/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...token ? { Authorization: `Bearer ${token}` } : {} },
        body: JSON.stringify({ id: deleteStudent.id })
      });
      setDeleteStudent(null);
      fetchStudents();
    } finally { 
      setIsSubmitting(false); 
    }
  };



  const calculatedEditExpiry = useMemo(() => {
    if (!editingEnrollment?.enrolledAt) return '';
    try {
      const [year, month, day] = editingEnrollment.enrolledAt.split('-').map(Number);
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 1}`;
    } catch {
      return '';
    }
  }, [editingEnrollment?.enrolledAt]);

  const calculatedBatchExpiry = useMemo(() => {
    if (!batchEnrollDate) return '';
    try {
      const [year, month, day] = batchEnrollDate.split('-').map(Number);
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year + 1}`;
    } catch {
      return '';
    }
  }, [batchEnrollDate]);

  return (
    <div className={styles.wrapper}>
      {/* Header: Search + Filter + Add Button */}
      <div className={styles.header}>
        <div className={styles.searchBar}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search students by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.headerActions}>
          <div className={styles.filterBar}>
            <div className={styles.searchBar} style={{ maxWidth: '240px' }}>
              <Filter size={16} />
              <select 
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
              >
                <option value="">All Students</option>
                <option value="none">Not Enrolled</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>In: {c.title}</option>
                ))}
              </select>
            </div>
            
            <div style={{ position: 'relative', minWidth: '180px' }}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                }}
                style={{
                  appearance: 'none',
                  width: '100%',
                  padding: '10px 40px 10px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass)',
                  color: 'var(--foreground)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease',
                }}
              >
                <option value="newest" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Newest First</option>
                <option value="oldest" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Oldest First</option>
                <option value="name_asc" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Name (A-Z)</option>
                <option value="name_desc" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Name (Z-A)</option>
              </select>
              <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                <ChevronDown size={16} />
              </div>
            </div>
          </div>
          <button className={dashStyles.primaryBtn} onClick={() => { 
            setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' }); 
            setMessage(null);
            setIsAddOpen(true); 
          }}>
            <GraduationCap size={16} /> New Student
          </button>
        </div>
      </div>

      {loading ? (
        <div className={dashStyles.loader}>
          <Loader variant="inline" text="Loading students..." />
          Loading students...
        </div>
      ) : filteredStudents.length > 0 ? (
        <>
          {/* Table */}
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input 
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Student</th>
                  <th>Programs Enrolled</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    className={selectedIds.has(student.id) ? styles.selectedRow : ''}
                    onClick={() => {
                      setAutoExpandCourseId(null);
                      setSelectedStudentForDetails(student);
                    }}
                  >
                    <td onClick={(e) => { e.stopPropagation(); handleToggleSelect(student.id); }} style={{ cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedIds.has(student.id)}
                        readOnly
                        style={{ pointerEvents: 'none' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--surface-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          color: 'var(--primary)',
                          position: 'relative',
                          overflow: 'hidden',
                          flexShrink: 0,
                          border: '1px solid var(--glass-border)'
                        }}>
                          {student.profileImage ? (
                            <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
                          ) : getInitials(student.fullName)}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{student.fullName}</h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StudentProgramsCell 
                        student={student} 
                        onCourseClick={(courseId) => {
                          const course = student.enrolledCourses.find(c => c.courseId === courseId);
                          if (course) {
                            setSelectedSingleCourse({
                              student,
                              courseId: course.courseId,
                              courseTitle: course.courseTitle,
                              enrolledAt: course.enrolledAt,
                              expiresAt: course.expiresAt
                            });
                          }
                        }}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                      <div className={styles.rowActions}>
                        <button 
                          className={styles.rowActionBtn}
                          onClick={() => { 
                            setFormData({ 
                              fullName: student.fullName, 
                              email: student.email, 
                              phone: student.phone || '', 
                              bmdcNumber: student.bmdcNumber || '', 
                              profileImage: student.profileImage || '' 
                            }); 
                            const initialEnrollments: Record<string, { selected: boolean, date: string, isExisting: boolean }> = {};
                            student.enrolledCourses.forEach(c => {
                              initialEnrollments[c.courseId] = {
                                selected: true,
                                date: c.enrolledAt ? formatDateInputGMT6(c.enrolledAt) : formatDateInputGMT6(new Date()),
                                isExisting: true
                              };
                            });
                            setEditEnrollments(initialEnrollments);
                            setEditStudent(student); 
                            setMessage(null); 
                          }} 
                          title="Edit Profile"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button 
                          className={styles.rowActionBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAutoExpandCourseId(null);
                            setSelectedStudentForDetails(student);
                          }}
                          title="View Details"
                        >
                          <Eye size={14} /> Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderTop: '1px solid var(--glass-border)',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}>
              <span>
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: currentPage <= 1 ? 'transparent' : 'var(--surface-soft)',
                    color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--foreground)',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage <= 1 ? 0.4 : 1,
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontWeight: 600, color: 'var(--foreground)', minWidth: '80px', textAlign: 'center' }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--glass-border)',
                    background: currentPage >= totalPages ? 'transparent' : 'var(--surface-soft)',
                    color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--foreground)',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage >= totalPages ? 0.4 : 1,
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className={styles.batchContainer}>
              <div className={styles.batchBar}>
                <div className={styles.batchLeft}>
                  <span className={styles.batchCount}>{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected</span>
                  <button className={styles.batchClear} onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </button>
                </div>
                <div className={styles.batchActions}>
                  <button 
                    className={`${styles.batchActionBtn} ${styles.primary}`}
                    onClick={() => { setShowEnrollPanel(!showEnrollPanel); setShowRemovePanel(false); setShowDatePanel(false); }}
                  >
                    <BookPlus size={15} /> Enroll
                  </button>
                  <button 
                    className={styles.batchActionBtn}
                    onClick={() => {
                      if (courseFilter && courseFilter !== 'none') {
                        const course = courses.find(c => c.id === courseFilter);
                        setEditingRulesFor({
                          courseId: courseFilter,
                          userIds: Array.from(selectedIds),
                          studentName: `${selectedIds.size} Selected Student(s) (${course?.title || 'Course'})`
                        });
                        setShowDatePanel(false);
                        setShowEnrollPanel(false);
                        setShowRemovePanel(false);
                      } else {
                        setShowDatePanel(!showDatePanel);
                        setShowEnrollPanel(false);
                        setShowRemovePanel(false);
                      }
                    }}
                  >
                    <CalendarClock size={15} /> Change Module Availability
                  </button>
                  <button 
                    className={`${styles.batchActionBtn} ${styles.danger}`}
                    onClick={() => { setShowRemovePanel(!showRemovePanel); setShowEnrollPanel(false); setShowDatePanel(false); }}
                  >
                    <Trash size={15} /> Remove
                  </button>
                </div>
              </div>

              {/* Enroll Panel */}
              {showEnrollPanel && (
                <div className={styles.enrollPanel}>
                  <div className={styles.enrollPanelHeader}>
                    <span className={styles.enrollPanelTitle}>
                      <BookPlus size={16} /> Bulk Enrollment
                    </span>
                    <button className={styles.enrollPanelClose} onClick={() => setShowEnrollPanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.enrollPanelBody}>
                    <div className={styles.enrollPanelField} style={{ flex: 1.5 }}>
                      <label>Course</label>
                      <select 
                        value={batchCourseId}
                        onChange={(e) => {
                          setBatchCourseId(e.target.value);
                          setBatchId('');
                        }}
                      >
                        <option value="">-- Select Course --</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.enrollPanelField} style={{ flex: 1.5 }}>
                      <label>Batch</label>
                      <select 
                        value={batchId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setBatchId(bId);
                          const selBatch = courseBatches.find(b => b.id === bId);
                          if (selBatch && !selBatch.name.toLowerCase().includes('custom') && selBatch.startDate) {
                            setBatchEnrollDate(new Date(selBatch.startDate).toISOString().split('T')[0]);
                          }
                        }}
                        disabled={!batchCourseId}
                      >
                        {!courseBatches.some(b => b.name.toLowerCase().includes('custom')) && (
                          <option value="">📦 Custom Batch (Custom Date)</option>
                        )}
                        {courseBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.name.toLowerCase().includes('custom') ? '📦 Custom Batch (Custom Date)' : `${b.name} (Starts: ${new Date(b.startDate).toLocaleDateString()})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const selBatch = courseBatches.find(b => b.id === batchId);
                      const isCustom = !batchId || selBatch?.name.toLowerCase().includes('custom');
                      const dateVal = isCustom 
                        ? batchEnrollDate 
                        : (selBatch?.startDate ? new Date(selBatch.startDate).toISOString().split('T')[0] : batchEnrollDate);

                      return (
                        <div className={styles.enrollPanelField} style={{ flex: 1 }}>
                          <label>{isCustom ? 'Enrollment Date' : 'Date (Set by Batch)'}</label>
                          <input 
                            type="date" 
                            value={dateVal}
                            disabled={!isCustom}
                            onChange={(e) => setBatchEnrollDate(e.target.value)}
                            style={{
                              opacity: !isCustom ? 0.6 : 1,
                              cursor: !isCustom ? 'not-allowed' : 'auto'
                            }}
                          />
                          {isCustom && batchEnrollDate && (
                            <span className={styles.expiryPreview}>Expires: {calculatedBatchExpiry}</span>
                          )}
                        </div>
                      );
                    })()}

                    <div className={styles.enrollPanelField} style={{ flex: '0 1 auto' }}>
                      <label style={{ visibility: 'hidden' }}>Action</label>
                      <button 
                        className={`${styles.batchActionBtn} ${styles.primary}`}
                        onClick={handleBatchEnrollSubmit}
                        disabled={isSubmitting || !batchCourseId}
                        style={{ padding: '0 20px', height: '42px', width: '100%', justifyContent: 'center' }}
                      >
                        {isSubmitting ? <><Loader variant="button" /> Enrolling...</> : 'Enroll Now'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Change Module Availability Panel */}
              {showDatePanel && (
                <div className={styles.enrollPanel}>
                  <div className={styles.enrollPanelHeader}>
                    <span className={styles.enrollPanelTitle}>
                      <CalendarClock size={16} /> Change Module Availability
                    </span>
                    <button className={styles.enrollPanelClose} onClick={() => setShowDatePanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.enrollPanelBody}>
                    <div className={styles.enrollPanelField} style={{ flex: 1 }}>
                      <label>Course</label>
                      <select 
                        value={datePanelCourseId}
                        onChange={(e) => setDatePanelCourseId(e.target.value)}
                      >
                        <option value="">-- Select Course --</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.enrollPanelField} style={{ flex: '0 1 auto' }}>
                      <label style={{ visibility: 'hidden' }}>Action</label>
                      <button 
                        className={`${styles.batchActionBtn} ${styles.primary}`}
                        onClick={() => {
                          if (datePanelCourseId) {
                            const course = courses.find(c => c.id === datePanelCourseId);
                            setEditingRulesFor({
                              courseId: datePanelCourseId,
                              userIds: Array.from(selectedIds),
                              studentName: `${selectedIds.size} Selected Student(s) (${course?.title || 'Course'})`
                            });
                            setShowDatePanel(false);
                          }
                        }}
                        disabled={!datePanelCourseId}
                        style={{ padding: '0 20px', height: '42px', width: '100%', justifyContent: 'center' }}
                      >
                        Configure Availability Rules
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bulk Remove Panel */}
              {showRemovePanel && (
                <div className={styles.enrollPanel}>
                  <div className={styles.enrollPanelHeader}>
                    <span className={styles.enrollPanelTitle} style={{ color: '#fca5a5' }}>
                      <Trash size={16} /> Bulk Remove from Course
                    </span>
                    <button className={styles.enrollPanelClose} onClick={() => setShowRemovePanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.enrollPanelBody}>
                    <div className={styles.enrollPanelField}>
                      <label>Remove from Course</label>
                      <select 
                        value={removeCourseId}
                        onChange={(e) => setRemoveCourseId(e.target.value)}
                      >
                        <option value="">-- Select Course --</option>
                        {courses.map(c => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.enrollPanelField} style={{ flex: '0 1 auto' }}>
                      <label style={{ visibility: 'hidden' }}>Action</label>
                      <button 
                        className={`${styles.batchActionBtn} ${styles.danger}`}
                        onClick={handleBatchRemove}
                        disabled={isSubmitting || !removeCourseId}
                        style={{ padding: '0 20px', height: '42px', width: '100%', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.15)' }}
                      >
                        {isSubmitting ? <><Loader variant="button" /> Removing...</> : 'Remove Students'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className={dashStyles.infoBox}>No students found matching your criteria.</div>
      )}

      {/* Student Enrollment Details Modal (click on row) */}
      {selectedStudentForDetails && (
        <StudentEnrollmentDetailsModal
          student={selectedStudentForDetails}
          defaultExpandedCourseId={autoExpandCourseId}
          onClose={() => {
            setSelectedStudentForDetails(null);
            setAutoExpandCourseId(null);
          }}
          onEditDate={(course) => {
            setEditingEnrollment({
              studentName: selectedStudentForDetails.fullName,
              courseTitle: course.courseTitle,
              orderId: course.orderId,
              enrolledAt: course.enrolledAt ? formatDateInputGMT6(course.enrolledAt) : formatDateInputGMT6(new Date()),
            });
          }}
          onEditRules={(course) => {
            setEditingRulesFor({
              courseId: course.courseId,
              userId: selectedStudentForDetails.id,
              studentName: selectedStudentForDetails.fullName,
            });
          }}
          onRevoke={(course) => {
            handleRevokeEnrollment(course.orderId, selectedStudentForDetails.fullName, course.courseTitle);
          }}
        />
      )}

      {selectedSingleCourse && (
        <SingleCourseProgressModal
          student={selectedSingleCourse.student}
          courseId={selectedSingleCourse.courseId}
          courseTitle={selectedSingleCourse.courseTitle}
          enrolledAt={selectedSingleCourse.enrolledAt}
          expiresAt={selectedSingleCourse.expiresAt}
          onClose={() => setSelectedSingleCourse(null)}
          onEditDate={() => {
            setEditingEnrollment({
              studentName: selectedSingleCourse.student.fullName,
              courseTitle: selectedSingleCourse.courseTitle,
              orderId: selectedSingleCourse.student.enrolledCourses.find(c => c.courseId === selectedSingleCourse.courseId)?.orderId || '',
              enrolledAt: selectedSingleCourse.enrolledAt || ''
            });
          }}
          onEditRules={() => {
            setEditingRulesFor({ 
              courseId: selectedSingleCourse.courseId, 
              userId: selectedSingleCourse.student.id,
              studentName: selectedSingleCourse.student.fullName 
            });
          }}
          onRevoke={() => {
            const orderId = selectedSingleCourse.student.enrolledCourses.find(c => c.courseId === selectedSingleCourse.courseId)?.orderId;
            if (orderId) {
              handleRevokeEnrollment(orderId, selectedSingleCourse.student.fullName, selectedSingleCourse.courseTitle);
            }
          }}
        />
      )}

      {/* Student Rules Modal */}
      {editingRulesFor && (
        <StudentRulesModal
          courseId={editingRulesFor.courseId}
          userId={editingRulesFor.userId}
          userIds={editingRulesFor.userIds}
          studentName={editingRulesFor.studentName}
          onClose={() => setEditingRulesFor(null)}
          onSuccess={() => {
            setEditingRulesFor(null);
            setSelectedIds(new Set());
            fetchStudents();
          }}
        />
      )}

      {/* Edit Enrollment Date Modal */}
      {editingEnrollment && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} glass`}>
            <div className={styles.modalHeader}>
              <h2>Edit Program Date</h2>
              <button onClick={() => setEditingEnrollment(null)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEnrollmentDate} className={styles.modalBody}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                <p style={{ margin: '0 0 4px 0' }}>Student: <strong>{editingEnrollment.studentName}</strong></p>
                <p style={{ margin: 0 }}>Program: <strong>{editingEnrollment.courseTitle}</strong></p>
              </div>

              <div className={styles.formGroup}>
                <label>Enrollment Date</label>
                <input 
                  type="date"
                  required
                  className={styles.input}
                  value={editingEnrollment.enrolledAt}
                  onChange={(e) => setEditingEnrollment({
                    ...editingEnrollment,
                    enrolledAt: e.target.value
                  })}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0' }}>
                Auto-calculated Expiry Date: <strong style={{ color: 'var(--primary)' }}>{calculatedEditExpiry}</strong>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className={dashStyles.confirmCancelBtn} style={{ flex: 1 }} onClick={() => setEditingEnrollment(null)} disabled={isSubmitting}>Cancel</button>
                <button type="submit" className={dashStyles.primaryBtn} style={{ flex: 1, justifyContent: 'center' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddOpen && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New Student</h2>
              <button onClick={() => setIsAddOpen(false)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className={styles.modalBody}>
              <div className={styles.imageUploadWrapper}>
                <label className={styles.imageLabel}>
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Preview" className={styles.imagePreview} />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <ImagePlus size={20} />
                      <span>Upload Photo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={styles.input} placeholder="e.g. John Doe" style={{ paddingLeft: '40px', width: '100%' }} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={styles.input} placeholder="student@example.com" style={{ paddingLeft: '40px', width: '100%' }} />
                </div>
              </div>
              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} placeholder="017..." style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>BM&DC Number</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={styles.input} placeholder="A-12345" style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
              </div>

              {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <button disabled={isSubmitting} type="submit" className={dashStyles.primaryBtn} style={{width: '100%', marginTop: '10px', justifyContent: 'center'}}>
                {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                {!isSubmitting && <Send size={16} style={{ marginLeft: '8px' }} />}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT PROFILE MODAL */}
      {editStudent && (
        <div className={styles.overlay}>
          <div className={`${styles.modal} glass`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit Student Profile</h2>
              <button onClick={() => setEditStudent(null)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleEdit} className={styles.modalBody}>
              <div className={styles.imageUploadWrapper}>
                <label className={styles.imageLabel}>
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Preview" className={styles.imagePreview} />
                  ) : (
                    <div className={styles.imagePlaceholder}>
                      <ImagePlus size={20} />
                      <span>Upload Photo</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                </label>
              </div>

              <div className={styles.formGroup}>
                <label>Full Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={styles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                </div>
              </div>
              
              <div className={styles.row}>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>Phone</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>BM&DC Number</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={styles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, fontSize: '0.9rem' }}>Manage Course Enrollments</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                  {courses.map(course => {
                    const state = editEnrollments[course.id] || { selected: false, date: formatDateInputGMT6(new Date()), isExisting: false };
                    
                    return (
                      <div key={course.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '12px', background: 'var(--surface-soft)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                            <input 
                              type="checkbox" 
                              className={styles.checkbox}
                              checked={state.selected}
                              onChange={(e) => {
                                setEditEnrollments(prev => ({
                                  ...prev,
                                  [course.id]: { ...state, selected: e.target.checked }
                                }));
                              }}
                            />
                            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{course.title}</span>
                          </label>
                          {state.isExisting && (
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--surface)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
                              Already Enrolled
                            </span>
                          )}
                        </div>
                        
                        {state.selected && !state.isExisting && (
                          <div style={{ paddingLeft: '28px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Enrollment Date</label>
                            <input
                              type="date"
                              required
                              className={styles.input}
                              style={{ padding: '8px', fontSize: '0.85rem' }}
                              value={state.date}
                              onChange={(e) => {
                                setEditEnrollments(prev => ({
                                  ...prev,
                                  [course.id]: { ...state, date: e.target.value }
                                }));
                              }}
                            />
                          </div>
                        )}
                        
                        {!state.selected && state.isExisting && (
                          <div style={{ paddingLeft: '28px', fontSize: '0.8rem', color: '#ef4444' }}>
                            Will be revoked upon saving
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <button disabled={isSubmitting} type="submit" className={dashStyles.primaryBtn} style={{width: '100%', marginTop: '10px', justifyContent: 'center'}}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DELETE STUDENT CONFIRM MODAL */}
      {deleteStudent && (
        <div className={dashStyles.confirmBackdrop} role="dialog">
          <div className={dashStyles.confirmDialog}>
            <h3>Delete Student?</h3>
            <p>Are you sure you want to completely remove <strong>{deleteStudent.fullName}</strong>? This will revoke all course access and delete their history. This action cannot be undone.</p>
            <div className={dashStyles.confirmActions}>
              <button className={dashStyles.confirmCancelBtn} onClick={() => setDeleteStudent(null)} disabled={isSubmitting}>Cancel</button>
              <button className={dashStyles.confirmPrimaryBtn} onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? "Deleting..." : "Permanently Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />
    </div>
  );
}
