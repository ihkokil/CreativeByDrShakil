'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { 
  Search, Edit2, Trash2, GraduationCap, X, 
  User, Mail, Phone, FileText, ImagePlus, Send, Calendar,
  ChevronDown, Filter, Eye, BookPlus, Trash, CalendarClock,
  ChevronLeft, ChevronRight, Users, BookOpen, Clock, Download,
  Settings, RefreshCw, Plus
} from 'lucide-react';

import styles from './StudentsManager.module.css';
import Loader from "@/components/UI/Loader";
import AlertModal from '@/components/UI/AlertModal';
import ConfirmModal from '@/components/UI/ConfirmModal';
import StudentRulesModal from '@/components/Teacher/StudentRulesModal';
import StudentEnrollmentDetailsModal from './StudentEnrollmentDetailsModal';
import SingleCourseProgressModal from './SingleCourseProgressModal';
import { useModal } from '@/hooks/useModal';
import { formatDateGMT6, formatDateInputGMT6 } from '@/lib/date-format';

interface EnrolledCourse {
  orderId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  enrolledAt: string | null;
  expiresAt: string | null;
  batchId?: string | null;
  batchName?: string | null;
  batchStartDate?: string | null;
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

function StudentProgramsCell({ 
  student, 
  onCourseClick 
}: { 
  student: StudentProfile;
  onCourseClick?: (courseId: string) => void;
}) {
  if (!student.enrolledCourses || student.enrolledCourses.length === 0) {
    return <span className={styles.noCoursesText}>No active programs</span>;
  }

  const now = new Date();

  return (
    <div className={styles.courseBadgeGroup}>
      {student.enrolledCourses.slice(0, 3).map((c) => {
        let isExpired = false;
        let isExpiringSoon = false;

        if (c.expiresAt) {
          const expDate = new Date(c.expiresAt);
          const daysLeft = (expDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (daysLeft < 0) isExpired = true;
          else if (daysLeft <= 14) isExpiringSoon = true;
        }

        const dotClass = isExpired 
          ? styles.dot_expired 
          : isExpiringSoon 
            ? styles.dot_expiring 
            : styles.dot_active;

        const dateTooltip = `Course: ${c.courseTitle}\nBatch: ${c.batchName || 'Standard / None'}\nEnrolled: ${c.enrolledAt ? formatDateGMT6(c.enrolledAt) : '—'}\nExpires: ${c.expiresAt ? formatDateGMT6(c.expiresAt) : '—'}`;

        return (
          <div 
            key={c.courseId} 
            className={styles.courseCardBadge}
            onClick={(e) => {
              e.stopPropagation();
              onCourseClick?.(c.courseId);
            }}
            title={dateTooltip}
          >
            <div className={styles.courseBadgeHeader}>
              <span className={`${styles.statusDot} ${dotClass}`} />
              <span className={styles.courseBadgeTitle}>{c.courseTitle}</span>
            </div>

            <div className={styles.courseMetaTags}>
              {c.batchName && (
                <span className={styles.batchSubBadge} title={`Batch: ${c.batchName}`}>
                  <Users size={11} />
                  <span>{c.batchName}</span>
                </span>
              )}
              {c.enrolledAt && (
                <span className={styles.dateSubBadge} title={`Enrolled on ${formatDateGMT6(c.enrolledAt)}`}>
                  <Calendar size={11} />
                  <span>{formatDateGMT6(c.enrolledAt)}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
      {student.enrolledCourses.length > 3 && (
        <span className={styles.moreCoursesBadge} title={student.enrolledCourses.slice(3).map(c => c.courseTitle).join(', ')}>
          +{student.enrolledCourses.length - 3} more
        </span>
      )}
    </div>
  );
}

export default function StudentsManager() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enrolled' | 'unenrolled'>('all');
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

  // Batch panels
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [showRemovePanel, setShowRemovePanel] = useState(false);
  const [removeCourseId, setRemoveCourseId] = useState('');
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [datePanelCourseId, setDatePanelCourseId] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<StudentProfile | null>(null);
  const [autoExpandCourseId, setAutoExpandCourseId] = useState<string | null>(null);
  const [selectedSingleCourse, setSelectedSingleCourse] = useState<{
    student: StudentProfile;
    courseId: string;
    courseTitle: string;
    enrolledAt: string | null;
    expiresAt: string | null;
    batchName?: string | null;
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
  const [editEnrollments, setEditEnrollments] = useState<Record<string, { selected: boolean, date: string, isExisting: boolean }>>({});

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title?: string;
    message: React.ReactNode | string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'primary';
    isSubmitting?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({ isOpen: false, message: '', onConfirm: () => {} });

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

  const showConfirm = (options: {
    title?: string;
    message: React.ReactNode | string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'primary';
    onConfirm: () => void | Promise<void>;
  }) => {
    setConfirmConfig({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Confirm',
      variant: options.variant || 'danger',
      isSubmitting: false,
      onConfirm: options.onConfirm,
    });
  };

  // Form states for Add/Edit
  const [formData, setFormData] = useState({ 
    fullName: '', 
    email: '', 
    phone: '', 
    bmdcNumber: '', 
    profileImage: '' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useModal(!!editStudent, () => { setEditStudent(null); setFormMessage(null); });
  useModal(isAddOpen, () => { setIsAddOpen(false); setFormMessage(null); });
  useModal(!!editingEnrollment, () => setEditingEnrollment(null));
  useModal(!!selectedStudentForDetails, () => setSelectedStudentForDetails(null));
  useModal(!!selectedSingleCourse, () => setSelectedSingleCourse(null));

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

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

  // Sync selected single course when student data updates
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
              batchName: courseEnrollment.batchName,
            });
          }
        } else {
          setSelectedSingleCourse(null);
        }
      }
    }
  }, [students, selectedSingleCourse]);

  // Top KPI Stats Computation
  const stats = useMemo(() => {
    const total = students.length;
    const enrolled = students.filter(s => s.enrolledCourses && s.enrolledCourses.length > 0).length;
    const unenrolled = total - enrolled;
    const totalEnrollments = students.reduce((acc, s) => acc + (s.enrolledCourses?.length || 0), 0);
    return { total, enrolled, unenrolled, totalEnrollments };
  }, [students]);

  const getInitials = (name: string) => {
    if (!name) return 'DR';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

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

  // Filtered & Sorted Students
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      // 1. Search Query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesName = s.fullName?.toLowerCase().includes(q);
        const matchesEmail = s.email?.toLowerCase().includes(q);
        const matchesPhone = s.phone?.toLowerCase().includes(q);
        const matchesBmdc = s.bmdcNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesBmdc) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'enrolled' && s.enrolledCourses.length === 0) return false;
      if (statusFilter === 'unenrolled' && s.enrolledCourses.length > 0) return false;

      // 3. Course Filter
      if (courseFilter === 'none') {
        if (s.enrolledCourses.length > 0) return false;
      } else if (courseFilter) {
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
        result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        break;
      case 'name_desc':
        result.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''));
        break;
      case 'courses_desc':
        result.sort((a, b) => b.enrolledCourses.length - a.enrolledCourses.length);
        break;
      case 'newest':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return result;
  }, [students, searchQuery, statusFilter, courseFilter, sortBy]);

  // Reset to first page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, courseFilter, sortBy]);

  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize);

  // Checkbox selection functions
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredStudents.length === 0) {
      showAlert('No students available to export.', 'warning');
      return;
    }
    const headers = ["Student ID", "Full Name", "Email", "Phone", "BMDC Number", "Registered At", "Total Courses", "Enrolled Programs (Course / Batch / Enroll Date)"];
    const rows = filteredStudents.map(s => {
      const coursesStr = s.enrolledCourses.map(c => {
        const parts = [c.courseTitle];
        if (c.batchName) parts.push(`[Batch: ${c.batchName}]`);
        if (c.enrolledAt) parts.push(`(Enrolled: ${formatDateGMT6(c.enrolledAt)})`);
        return parts.join(' ');
      }).join("; ");
      return [
        `"${s.id}"`,
        `"${s.fullName || ''}"`,
        `"${s.email || ''}"`,
        `"${s.phone || ''}"`,
        `"${s.bmdcNumber || ''}"`,
        `"${s.createdAt ? formatDateGMT6(s.createdAt) : ''}"`,
        `"${s.enrolledCourses.length}"`,
        `"${coursesStr.replace(/"/g, '""')}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `student_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert(`Exported ${filteredStudents.length} student records to CSV.`, 'success');
  };

  // Batch Enrollment Submit
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
        showAlert(`Successfully enrolled ${selectedIds.size} student(s) into the course!`, 'success', 'Bulk Enrollment Complete');
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
  const handleBatchRemove = () => {
    if (!removeCourseId) {
      showAlert('Please select a course to remove students from.', 'warning');
      return;
    }

    const selectedStudentNames = Array.from(selectedIds)
      .map(id => students.find(s => s.id === id)?.fullName)
      .filter(Boolean)
      .join(', ');
    const course = courses.find(c => c.id === removeCourseId);

    showConfirm({
      title: `Remove from "${course?.title || 'Course'}"?`,
      message: `Are you sure you want to remove ${selectedIds.size} student(s) from "${course?.title}"?\n\nTarget Students: ${selectedStudentNames}`,
      confirmText: 'Remove Students',
      variant: 'danger',
      onConfirm: async () => {
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

          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          showAlert(`Removed ${successCount} student(s) from "${course?.title}".`, 'success', 'Batch Remove Complete');
          setSelectedIds(new Set());
          setShowRemovePanel(false);
          setRemoveCourseId('');
          fetchStudents();
        } catch (err: any) {
          showAlert(err.message || 'Failed to remove students.', 'error');
        }
      }
    });
  };

  // Revoke Single Enrollment
  const handleRevokeEnrollment = (orderId: string, studentName: string, courseTitle: string) => {
    showConfirm({
      title: 'Revoke Course Access?',
      message: `Are you sure you want to revoke ${studentName}'s access to "${courseTitle}"? They will lose access to modules and quizzes immediately.`,
      confirmText: 'Revoke Access',
      variant: 'danger',
      onConfirm: async () => {
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
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            showAlert(`Revoked ${studentName}'s access to "${courseTitle}".`, 'success');
            fetchStudents();
          } else {
            const data = await res.json();
            showAlert(data.error || 'Failed to revoke enrollment.', 'error');
          }
        } catch (err) {
          showAlert('Network error while revoking enrollment.', 'error');
        }
      }
    });
  };

  // Single Student Delete (From Directory)
  const handleDeleteStudent = (student: StudentProfile) => {
    showConfirm({
      title: 'Delete Student Account?',
      message: `Are you sure you want to completely remove ${student.fullName}? This will revoke all course access and delete their study history. This action cannot be undone.`,
      confirmText: 'Permanently Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch('/api/admin/students/manage', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ id: student.id })
          });
          if (res.ok) {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            showAlert(`Student "${student.fullName}" was deleted successfully.`, 'success');
            fetchStudents();
          } else {
            const data = await res.json();
            showAlert(data.error || 'Failed to delete student.', 'error');
          }
        } catch (err) {
          showAlert('Network error while deleting student.', 'error');
        }
      }
    });
  };

  // Add Student Handler
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMessage(null);
    try {
      const res = await fetch('/api/admin/students/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        setFormMessage({ type: 'success', text: data.message || 'Student added and invitation sent.' });
        setTimeout(() => {
          setIsAddOpen(false);
          setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' });
          fetchStudents();
        }, 1500);
      } else {
        setFormMessage({ type: 'error', text: data.error || 'Failed to add student.' });
      }
    } catch (err) {
      setFormMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // Edit Student Profile Handler
  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    setIsSubmitting(true);
    setFormMessage(null);
    try {
      const res = await fetch('/api/admin/students/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: editStudent.id, ...formData })
      });
      const data = await res.json();

      if (res.ok) {
        let enrollmentErrors: string[] = [];

        for (const course of courses) {
          const editState = editEnrollments[course.id];
          if (!editState) continue;

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
              if (!resEnroll.ok) enrollmentErrors.push(`Failed to enroll in ${course.title}`);
            } catch (err) {
              enrollmentErrors.push(`Network error for ${course.title}`);
            }
          } else if (!editState.selected && editState.isExisting) {
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
                if (!resRevoke.ok) enrollmentErrors.push(`Failed to revoke ${course.title}`);
              } catch (err) {
                enrollmentErrors.push(`Network error for ${course.title}`);
              }
            }
          }
        }

        if (enrollmentErrors.length > 0) {
          setFormMessage({ type: 'error', text: `Profile updated, but: ${enrollmentErrors.join(', ')}` });
          setTimeout(() => { setEditStudent(null); fetchStudents(); }, 3000);
        } else {
          setFormMessage({ type: 'success', text: 'Student profile and enrollments updated successfully.' });
          setTimeout(() => { setEditStudent(null); fetchStudents(); }, 1200);
        }
      } else {
        setFormMessage({ type: 'error', text: data.error || 'Failed to update student.' });
      }
    } catch (err) {
      setFormMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally { 
      setIsSubmitting(false); 
    }
  };

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
      {/* Top 4 KPI Metric Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.icon_total}`}>
            <Users size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiValue}>{stats.total}</span>
            <span className={styles.kpiLabel}>Total Registered</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.icon_enrolled}`}>
            <GraduationCap size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiValue}>{stats.enrolled}</span>
            <span className={styles.kpiLabel}>Active Enrolled</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.icon_unenrolled}`}>
            <Clock size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiValue}>{stats.unenrolled}</span>
            <span className={styles.kpiLabel}>Not Enrolled</span>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.icon_courses}`}>
            <BookOpen size={22} />
          </div>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiValue}>{stats.totalEnrollments}</span>
            <span className={styles.kpiLabel}>Total Course Seats</span>
          </div>
        </div>
      </div>

      {/* Main Search & Control Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarTop}>
          <form className={styles.searchBox} onSubmit={(e) => e.preventDefault()}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search by name, email, phone, or BM&DC..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search students"
            />
            {searchQuery && (
              <button 
                type="button" 
                className={styles.clearSearchBtn} 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </form>

          <div className={styles.toolbarActions}>
            <select 
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className={styles.filterSelect}
              aria-label="Filter by course"
            >
              <option value="">All Programs</option>
              <option value="none">No Programs Enrolled</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>Course: {c.title}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.filterSelect}
              aria-label="Sort students"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name_asc">Sort: Name (A-Z)</option>
              <option value="name_desc">Sort: Name (Z-A)</option>
              <option value="courses_desc">Sort: Most Enrolled</option>
            </select>

            <button 
              type="button" 
              className={styles.exportBtn} 
              onClick={handleExportCSV}
              title="Export roster to CSV"
            >
              <Download size={15} /> Export CSV
            </button>

            <button 
              type="button" 
              className={styles.newStudentBtn} 
              onClick={() => { 
                setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' }); 
                setFormMessage(null);
                setIsAddOpen(true); 
              }}
            >
              <Plus size={16} /> New Student
            </button>
          </div>
        </div>

        {/* Quick Filter Segment Chips */}
        <div className={styles.chipsRow}>
          <div className={styles.segmentChips}>
            <button 
              type="button"
              className={`${styles.segmentChip} ${statusFilter === 'all' ? styles.active : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Students ({stats.total})
            </button>
            <button 
              type="button"
              className={`${styles.segmentChip} ${statusFilter === 'enrolled' ? styles.active : ''}`}
              onClick={() => setStatusFilter('enrolled')}
            >
              🟢 Active Enrolled ({stats.enrolled})
            </button>
            <button 
              type="button"
              className={`${styles.segmentChip} ${statusFilter === 'unenrolled' ? styles.active : ''}`}
              onClick={() => setStatusFilter('unenrolled')}
            >
              ⏳ Not Enrolled ({stats.unenrolled})
            </button>
          </div>

          <div className={styles.resultCount}>
            Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table Container */}
      {loading ? (
        <div className={styles.emptyState}>
          <Loader variant="inline" text="Loading student directory..." />
          <h3 className={styles.emptyTitle}>Loading Roster...</h3>
          <p className={styles.emptyDesc}>Synchronizing enrolled student records.</p>
        </div>
      ) : filteredStudents.length > 0 ? (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '44px', textAlign: 'center' }}>
                    <input 
                      type="checkbox"
                      className={styles.checkbox}
                      checked={selectedIds.size === filteredStudents.length && filteredStudents.length > 0}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all students"
                    />
                  </th>
                  <th>Student Info</th>
                  <th>Programs & Validity</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const isSelected = selectedIds.has(student.id);

                  return (
                    <tr 
                      key={student.id} 
                      className={isSelected ? styles.selectedRow : ''}
                      onClick={() => {
                        setAutoExpandCourseId(null);
                        setSelectedStudentForDetails(student);
                      }}
                    >
                      <td 
                        className={styles.selectCell}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          handleToggleSelect(student.id); 
                        }}
                      >
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={isSelected}
                          readOnly
                          style={{ pointerEvents: 'none' }}
                          aria-label={`Select ${student.fullName}`}
                        />
                      </td>
                      <td className={styles.infoCell}>
                        <div className={styles.studentCell}>
                          <div className={styles.avatar}>
                            {student.profileImage ? (
                              <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
                            ) : (
                              getInitials(student.fullName)
                            )}
                          </div>
                          <div className={styles.studentMeta}>
                            <h4 className={styles.studentName}>{student.fullName}</h4>
                            <span className={styles.studentEmail}>{student.email}</span>
                            <div className={styles.tagRow}>
                              {student.bmdcNumber && (
                                <span className={styles.bmdcTag} title="BM&DC Registration Number">
                                  BMDC: {student.bmdcNumber}
                                </span>
                              )}
                              {student.phone && (
                                <span className={styles.phoneTag} title="Phone Number">
                                  📞 {student.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.programsCell}>
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
                                expiresAt: course.expiresAt,
                                batchName: course.batchName,
                              });
                            }
                          }}
                        />
                      </td>
                      <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.actionGroup}>
                          <button 
                            type="button"
                            className={styles.actionBtnPill}
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
                              setFormMessage(null); 
                            }} 
                            title="Edit Student Profile"
                          >
                            <Edit2 size={13} /> Edit
                          </button>

                          <button 
                            type="button"
                            className={styles.actionBtnPill}
                            onClick={() => {
                              setAutoExpandCourseId(null);
                              setSelectedStudentForDetails(student);
                            }}
                            title="View Full Enrollment Details"
                          >
                            <Eye size={13} /> Details
                          </button>

                          <button
                            type="button"
                            className={`${styles.actionBtnPill} ${styles.actionBtnDelete}`}
                            onClick={() => handleDeleteStudent(student)}
                            title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className={styles.paginationBar}>
                <span>
                  Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredStudents.length)} of {filteredStudents.length} students
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className={styles.pageBtn}
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 700, color: 'var(--foreground)', minWidth: '90px', textAlign: 'center' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className={styles.pageBtn}
                    aria-label="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className={styles.batchContainer}>
              <div className={styles.batchBar}>
                <div className={styles.batchLeft}>
                  <span className={styles.batchCount}>{selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected</span>
                  <button type="button" className={styles.batchClear} onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </button>
                </div>
                <div className={styles.batchActions}>
                  <button 
                    type="button"
                    className={`${styles.batchActionBtn} ${styles.primary}`}
                    onClick={() => { setShowEnrollPanel(!showEnrollPanel); setShowRemovePanel(false); setShowDatePanel(false); }}
                  >
                    <BookPlus size={15} /> Bulk Enroll
                  </button>
                  <button 
                    type="button"
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
                    <CalendarClock size={15} /> Change Rules
                  </button>
                  <button 
                    type="button"
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
                      <BookPlus size={16} /> Bulk Course Enrollment
                    </span>
                    <button type="button" className={styles.enrollPanelClose} onClick={() => setShowEnrollPanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.enrollPanelBody}>
                    <div className={styles.enrollPanelField} style={{ flex: 1.5 }}>
                      <label>Target Course</label>
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
                      <label>Target Batch / Cohort</label>
                      <select 
                        value={batchId}
                        onChange={(e) => {
                          const bId = e.target.value;
                          setBatchId(bId);
                          const selBatch = courseBatches.find(b => b.id === bId);
                          const isStartTodayOrCustom = selBatch && (selBatch.name.toLowerCase().includes('start today') || selBatch.name.toLowerCase().includes('custom'));
                          if (selBatch && !isStartTodayOrCustom && selBatch.startDate) {
                            setBatchEnrollDate(new Date(selBatch.startDate).toISOString().split('T')[0]);
                          }
                        }}
                        disabled={!batchCourseId}
                      >
                        {!courseBatches.some(b => b.name.toLowerCase().includes('start today') || b.name.toLowerCase().includes('custom')) && (
                          <option value="">🚀 Start Today Batch (Custom Date)</option>
                        )}
                        {courseBatches.map(b => {
                          const nameLower = b.name.toLowerCase();
                          let label = `${b.name} (Starts: ${new Date(b.startDate).toLocaleDateString()})`;
                          if (nameLower.includes('start today') || nameLower.includes('custom')) {
                            label = '🚀 Start Today Batch (Custom Date)';
                          } else if (nameLower.includes('all unlocked') || nameLower.includes('instant')) {
                            label = '⚡ All Unlocked Batch (Instant Access)';
                          }
                          return (
                            <option key={b.id} value={b.id}>{label}</option>
                          );
                        })}
                      </select>
                    </div>

                    {(() => {
                      const selBatch = courseBatches.find(b => b.id === batchId);
                      const isCustom = !batchId || selBatch?.name.toLowerCase().includes('start today') || selBatch?.name.toLowerCase().includes('custom');
                      const dateVal = isCustom 
                        ? batchEnrollDate 
                        : (selBatch?.startDate ? new Date(selBatch.startDate).toISOString().split('T')[0] : batchEnrollDate);

                      return (
                        <div className={styles.enrollPanelField} style={{ flex: 1 }}>
                          <label>{isCustom ? 'Enrollment Date' : 'Date (Batch Fixed)'}</label>
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
                        type="button"
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

              {/* Bulk Remove Panel */}
              {showRemovePanel && (
                <div className={styles.enrollPanel}>
                  <div className={styles.enrollPanelHeader}>
                    <span className={styles.enrollPanelTitle} style={{ color: 'var(--error)' }}>
                      <Trash size={16} /> Bulk Remove from Course
                    </span>
                    <button type="button" className={styles.enrollPanelClose} onClick={() => setShowRemovePanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.enrollPanelBody}>
                    <div className={styles.enrollPanelField} style={{ flex: 2 }}>
                      <label>Select Course to Remove From</label>
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
                        type="button"
                        className={`${styles.batchActionBtn} ${styles.danger}`}
                        onClick={handleBatchRemove}
                        disabled={isSubmitting || !removeCourseId}
                        style={{ padding: '0 20px', height: '42px', width: '100%', justifyContent: 'center' }}
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
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Users size={28} />
          </div>
          <h3 className={styles.emptyTitle}>No Students Found</h3>
          <p className={styles.emptyDesc}>
            {searchQuery || courseFilter || statusFilter !== 'all'
              ? "No students match your active filters and search query."
              : "Your student directory is currently empty."}
          </p>
          {(searchQuery || courseFilter || statusFilter !== 'all') && (
            <button 
              type="button" 
              className={styles.resetBtn}
              onClick={() => {
                setSearchQuery('');
                setCourseFilter('');
                setStatusFilter('all');
              }}
            >
              <RefreshCw size={14} style={{ marginRight: '6px' }} /> Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Student Enrollment Details Modal (Click on row or details button) */}
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

      {/* Single Course Progress Modal */}
      {selectedSingleCourse && (
        <SingleCourseProgressModal
          student={selectedSingleCourse.student}
          courseId={selectedSingleCourse.courseId}
          courseTitle={selectedSingleCourse.courseTitle}
          enrolledAt={selectedSingleCourse.enrolledAt}
          expiresAt={selectedSingleCourse.expiresAt}
          batchName={selectedSingleCourse.batchName}
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
            showAlert('Module availability rules updated successfully!', 'success');
            fetchStudents();
          }}
        />
      )}

      {/* ADD STUDENT MODAL */}
      {isAddOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                  <input required type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className={styles.input} placeholder="e.g. Dr. John Doe" style={{ paddingLeft: '40px', width: '100%' }} />
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
                  <label>Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} placeholder="017..." style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>BM&DC Registration No.</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={styles.input} placeholder="A-12345" style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
              </div>

              {formMessage && (
                <div className={`${styles.message} ${styles[formMessage.type]}`}>
                  {formMessage.text}
                </div>
              )}

              <button disabled={isSubmitting} type="submit" className={styles.newStudentBtn} style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>
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
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
                  <label>Phone Number</label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={styles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
                <div className={`${styles.formGroup} ${styles.halfWidth}`}>
                  <label>BM&DC Registration No.</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="text" value={formData.bmdcNumber} onChange={e => setFormData({...formData, bmdcNumber: e.target.value})} className={styles.input} style={{ paddingLeft: '40px', width: '100%' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Manage Program Enrollments</label>
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
                            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{course.title}</span>
                          </label>
                          {state.isExisting && (
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--card-bg)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', fontWeight: 600 }}>
                              Enrolled
                            </span>
                          )}
                        </div>
                        
                        {state.selected && !state.isExisting && (
                          <div style={{ paddingLeft: '28px' }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Enrollment Start Date</label>
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
                          <div style={{ paddingLeft: '28px', fontSize: '0.8rem', color: 'var(--error)', fontWeight: 500 }}>
                            Will be revoked upon saving
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {formMessage && (
                <div className={`${styles.message} ${styles[formMessage.type]}`}>
                  {formMessage.text}
                </div>
              )}

              <button disabled={isSubmitting} type="submit" className={styles.newStudentBtn} style={{ width: '100%', marginTop: '10px', justifyContent: 'center' }}>
                {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        isSubmitting={confirmConfig.isSubmitting}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

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
