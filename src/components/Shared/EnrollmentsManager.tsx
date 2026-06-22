import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Search, Filter, Loader2, Eye } from 'lucide-react';
import dashStyles from '@/app/admin/dashboard/AdminDashboard.module.css';
import styles from './StudentsManager.module.css';
import StudentRulesModal from '@/components/Teacher/StudentRulesModal';
import StudentEnrollmentDetailsModal from './StudentEnrollmentDetailsModal';

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

export default function EnrollmentsManager() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState(''); // '' means All, 'none' means No Courses
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingEnrollment, setEditingEnrollment] = useState<{
    studentName: string;
    courseTitle: string;
    orderId: string;
    enrolledAt: string;
  } | null>(null);
  const [editingRulesFor, setEditingRulesFor] = useState<{
    courseId: string;
    userId: string;
    studentName: string;
  } | null>(null);
  const [bulkEditingRulesFor, setBulkEditingRulesFor] = useState<{
    courseId: string;
    userIds: string[];
    studentName: string;
  } | null>(null);
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<StudentProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchEnrollDate, setBatchEnrollDate] = useState(() => new Date().toISOString().split('T')[0]);

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/students', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.students) {
        setStudents(data.students);
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCourses = useCallback(async () => {
    try {
      // Use dynamic courses which works for both admin and teacher context
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

  const getInitials = (name: string) => {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // Search filter
      const matchesSearch = s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (!matchesSearch) return false;

      // Course filter
      if (!courseFilter) return true; // All
      if (courseFilter === 'none') return s.enrolledCourses.length === 0;
      
      return s.enrolledCourses.some(c => c.courseId === courseFilter);
    });
  }, [students, searchQuery, courseFilter]);

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

  // Batch Enrollment Submit
  const handleBatchEnrollSubmit = async () => {
    if (!batchCourseId) {
      alert('Please select a course to enroll.');
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
          enrolledAt: batchEnrollDate,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Students enrolled successfully!');
        setSelectedIds(new Set());
        setBatchCourseId('');
        fetchStudents();
      } else {
        alert(data.error || 'Failed to enroll students.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to process bulk enrollment.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        alert(data.error || 'Failed to update enrollment date.');
      }
    } catch (err) {
      alert('Network error while updating enrollment.');
    } finally {
      setIsSubmitting(false);
      // We don't refresh the student in the details modal automatically here to avoid losing context, 
      // but fetchStudents() will update the table. We should close the edit date modal.
    }
  };

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
        alert(data.error || 'Failed to revoke enrollment.');
      }
    } catch (err) {
      alert('Network error while revoking enrollment.');
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header} style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div className={styles.searchBar} style={{ flex: '1 1 300px' }}>
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search students by name or email..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className={styles.searchBar} style={{ flex: '0 0 auto', minWidth: '250px' }}>
          <Filter size={18} style={{ color: 'var(--text-muted)' }} />
          <select 
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="">All Students (Any Course)</option>
            <option value="none">Not Enrolled in Any Course</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>Enrolled in: {c.title}</option>
            ))}
          </select>
          <div style={{ position: 'absolute', right: '14px', pointerEvents: 'none', color: 'var(--text-muted)' }}>▼</div>
        </div>
      </div>

      {loading ? (
        <div className={dashStyles.loader}>
          <Loader2 className={dashStyles.spinner} />
          Loading enrollments...
        </div>
      ) : filteredStudents.length > 0 ? (
        <>
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
                  <th>Student Details</th>
                  <th>Current Enrollments</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr 
                    key={student.id} 
                    onClick={() => setSelectedStudentForDetails(student)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td onClick={(e) => { e.stopPropagation(); handleToggleSelect(student.id); }}>
                      <input 
                        type="checkbox" 
                        className={styles.checkbox}
                        checked={selectedIds.has(student.id)}
                        onChange={() => handleToggleSelect(student.id)}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--surface-soft)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: 'var(--primary)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {student.profileImage ? (
                            <Image src={student.profileImage} alt={student.fullName} fill style={{ objectFit: 'cover' }} unoptimized/>
                          ) : getInitials(student.fullName)}
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700 }}>{student.fullName}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{student.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ 
                          fontWeight: 600, 
                          color: student.enrolledCourses.length > 0 ? 'var(--foreground)' : 'var(--text-muted)' 
                        }}>
                          {student.enrolledCourses.length} Course(s)
                        </span>
                        {student.enrolledCourses.length > 0 && (
                          <button 
                            className={styles.viewDetailsBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStudentForDetails(student);
                            }}
                          >
                            <Eye size={14} /> View Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* BATCH ENROLLMENT BAR */}
          {selectedIds.size > 0 && (
            <div className={styles.batchBar}>
              <div className={styles.batchGroup}>
                <span className={styles.batchText}>{selectedIds.size} student(s) selected</span>
                <select 
                  className={styles.select}
                  value={batchCourseId}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  style={{ minWidth: '220px' }}
                >
                  <option value="">-- Select Course to Assign --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={styles.batchText} style={{ fontSize: '0.8rem' }}>Start Date:</span>
                  <input 
                    type="date" 
                    className={styles.dateInput}
                    value={batchEnrollDate}
                    onChange={(e) => setBatchEnrollDate(e.target.value)}
                  />
                </div>
              </div>
              <button 
                className={dashStyles.primaryBtn}
                onClick={handleBatchEnrollSubmit}
                disabled={isSubmitting || !batchCourseId}
              >
                {isSubmitting ? 'Enrolling...' : 'Bulk Assign Course'}
              </button>
              <button
                className={dashStyles.secondaryBtn}
                disabled={isSubmitting || !batchCourseId}
                onClick={() => {
                  setBulkEditingRulesFor({
                    courseId: batchCourseId,
                    userIds: Array.from(selectedIds),
                    studentName: `${selectedIds.size} Selected Student(s)`,
                  });
                }}
              >
                Bulk Edit Rules
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={dashStyles.infoBox}>No students found matching your criteria.</div>
      )}

      {/* Bulk Editing Rules Modal */}
      {bulkEditingRulesFor && (
        <StudentRulesModal
          courseId={bulkEditingRulesFor.courseId}
          userIds={bulkEditingRulesFor.userIds}
          studentName={bulkEditingRulesFor.studentName}
          onClose={() => setBulkEditingRulesFor(null)}
          onSuccess={() => {
            setBulkEditingRulesFor(null);
            alert('Successfully updated module rules for selected students.');
          }}
        />
      )}

      {/* Individual Rules Modal (optional here but good to have if we need it) */}
      {editingRulesFor && (
        <StudentRulesModal
          courseId={editingRulesFor.courseId}
          userId={editingRulesFor.userId}
          studentName={editingRulesFor.studentName}
          onClose={() => setEditingRulesFor(null)}
          onSuccess={() => {
            setEditingRulesFor(null);
          }}
        />
      )}

      {/* View Student Details Modal */}
      {selectedStudentForDetails && (
        <StudentEnrollmentDetailsModal
          student={selectedStudentForDetails}
          onClose={() => setSelectedStudentForDetails(null)}
          onEditDate={(course) => {
            setEditingEnrollment({
              studentName: selectedStudentForDetails.fullName,
              courseTitle: course.courseTitle,
              orderId: course.orderId,
              enrolledAt: course.enrolledAt ? new Date(course.enrolledAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
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

      {/* Edit Single Enrollment Date Modal */}
      {editingEnrollment && (
        <div className={styles.modalBackdrop} onClick={() => setEditingEnrollment(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit Enrollment Date</h2>
            </div>
            <div className={styles.modalBody}>
              <p>Change start date for <strong>{editingEnrollment.studentName}</strong> in <strong>{editingEnrollment.courseTitle}</strong></p>
              <input 
                type="date" 
                className={styles.dateInput}
                value={editingEnrollment.enrolledAt}
                onChange={(e) => setEditingEnrollment({ ...editingEnrollment, enrolledAt: e.target.value })}
              />
              <div className={styles.actions}>
                <button className={dashStyles.secondaryBtn} onClick={() => setEditingEnrollment(null)}>Cancel</button>
                <button className={dashStyles.primaryBtn} onClick={handleSaveEnrollmentDate} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Date'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
