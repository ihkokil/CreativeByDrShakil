import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Search, Filter, Loader2, Eye, Users, X } from 'lucide-react';
import dashStyles from '@/app/admin/dashboard/AdminDashboard.module.css';
import styles from './EnrollmentsManager.module.css';
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
  const [selectedStudentForDetails, setSelectedStudentForDetails] = useState<StudentProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchEnrollDate, setBatchEnrollDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Integrated module rules states
  const [ruleAction, setRuleAction] = useState<"start_from_today" | "custom_date" | "week_days" | "custom_interval" | "unlock_all">("start_from_today");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState<number>(7);
  const [ruleStartDate, setRuleStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [ruleEndDate, setRuleEndDate] = useState<string>("");

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

  const toggleDay = (val: number) => {
    setDaysOfWeek(prev => 
      prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]
    );
  };

  const handleUnifiedSubmit = async () => {
    if (!batchCourseId) {
      alert('Please select a course to assign.');
      return;
    }
    
    if (ruleAction === "week_days" && daysOfWeek.length === 0) {
      alert('Please select at least one day of the week.');
      return;
    }

    if (ruleAction === "custom_date") {
      if (!ruleStartDate) {
        alert('Please enter a start date.');
        return;
      }
      if (ruleEndDate && new Date(ruleEndDate) < new Date(ruleStartDate)) {
        alert('End date cannot be earlier than start date.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Bulk Enroll Students
      const enrollRes = await fetch('/api/students', {
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

      const enrollData = await enrollRes.json();
      if (!enrollRes.ok) {
        throw new Error(enrollData.error || 'Failed to enroll students.');
      }

      // 2. Apply Custom Module Release Rules
      const rulesRes = await fetch('/api/teacher/students/batch-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          courseId: batchCourseId,
          userIds: Array.from(selectedIds),
          action: ruleAction,
          daysOfWeek,
          intervalDays,
          startDate: ruleAction === "custom_date" ? ruleStartDate : undefined,
          endDate: ruleAction === "custom_date" ? ruleEndDate || undefined : undefined
        }),
      });

      const rulesData = await rulesRes.json();
      if (!rulesRes.ok) {
        throw new Error(rulesData.error || 'Enrollment succeeded but failed to apply module availability rules.');
      }

      alert('Successfully enrolled students and configured module availability rules.');
      
      // Reset Selection and Sidebar State
      setSelectedIds(new Set());
      setBatchCourseId('');
      setRuleAction('start_from_today');
      setDaysOfWeek([]);
      setIntervalDays(7);
      setRuleStartDate(new Date().toISOString().split('T')[0]);
      setRuleEndDate('');
      
      // Refresh students list
      fetchStudents();
    } catch (err: any) {
      alert(err.message || 'Failed to complete enrollment process.');
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
    <div className={styles.container}>
      {/* LEFT COLUMN: SIDEBAR CONFIGURATION */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>
            <Users size={18} style={{ color: 'var(--primary)' }} />
            Enrollment Details
          </h3>
          <p className={styles.sidebarSubtitle}>
            Configure program access and availability rules for selected students.
          </p>
        </div>

        {selectedIds.size === 0 ? (
          <div className={styles.emptyState}>
            <Users size={32} />
            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>No Students Selected</p>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              Select one or more students from the list on the right to start.
            </span>
          </div>
        ) : (
          <>
            <div className={styles.formGroup}>
              <span className={styles.formSectionTitle}>Selected Students ({selectedIds.size})</span>
              <div className={styles.selectedStudentsList}>
                {Array.from(selectedIds).map(id => {
                  const student = students.find(s => s.id === id);
                  if (!student) return null;
                  return (
                    <div key={student.id} className={styles.studentBadge}>
                      <div className={styles.badgeAvatar}>
                        {getInitials(student.fullName)}
                      </div>
                      <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {student.fullName}
                      </span>
                      <button 
                        type="button" 
                        className={styles.removeBadgeBtn}
                        onClick={() => handleToggleSelect(student.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Assign Program / Course</label>
              <select 
                className={styles.select}
                value={batchCourseId}
                onChange={(e) => setBatchCourseId(e.target.value)}
              >
                <option value="">-- Choose Course --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Enrollment Start Date</label>
              <input 
                type="date" 
                className={styles.dateInput}
                value={batchEnrollDate}
                onChange={(e) => setBatchEnrollDate(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formSectionTitle}>Module Availability Option</span>
              <div className={styles.optionsGroup}>
                <div 
                  className={`${styles.optionCard} ${ruleAction === "unlock_all" ? styles.selected : ""}`}
                  onClick={() => setRuleAction("unlock_all")}
                >
                  <div className={styles.optionHeader}>
                    <div className={styles.radio}></div>
                    <span className={styles.optionTitle}>Make all modules available</span>
                  </div>
                  <div className={styles.optionDesc}>
                    This will instantly unlock every module in the course.
                  </div>
                </div>

                <div 
                  className={`${styles.optionCard} ${ruleAction === "start_from_today" ? styles.selected : ""}`}
                  onClick={() => setRuleAction("start_from_today")}
                >
                  <div className={styles.optionHeader}>
                    <div className={styles.radio}></div>
                    <span className={styles.optionTitle}>Start from Enrollment date (Default)</span>
                  </div>
                  <div className={styles.optionDesc}>
                    All are locked & each module will be available following the module rule, starting from the enrollment date.
                  </div>
                </div>

                <div 
                  className={`${styles.optionCard} ${ruleAction === "custom_date" ? styles.selected : ""}`}
                  onClick={() => setRuleAction("custom_date")}
                >
                  <div className={styles.optionHeader}>
                    <div className={styles.radio}></div>
                    <span className={styles.optionTitle}>Custom Date Range</span>
                  </div>
                  <div className={styles.optionDesc}>
                    Restrict module access to a custom date range. Auto-locks after expiry.
                  </div>
                  {ruleAction === "custom_date" && (
                    <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                      <div className={styles.dateInputsGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        <div className={styles.dateInputGroup} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Start Date:</label>
                          <input 
                            type="date" 
                            value={ruleStartDate}
                            onChange={(e) => setRuleStartDate(e.target.value)}
                            style={{ background: 'color-mix(in srgb, var(--background) 80%, transparent)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--foreground)', fontWeight: 600 }}
                          />
                        </div>
                        <div className={styles.dateInputGroup} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>End Date:</label>
                          <input 
                            type="date" 
                            value={ruleEndDate}
                            onChange={(e) => setRuleEndDate(e.target.value)}
                            style={{ background: 'color-mix(in srgb, var(--background) 80%, transparent)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--foreground)', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div 
                  className={`${styles.optionCard} ${ruleAction === "week_days" ? styles.selected : ""}`}
                  onClick={() => setRuleAction("week_days")}
                >
                  <div className={styles.optionHeader}>
                    <div className={styles.radio}></div>
                    <span className={styles.optionTitle}>Week days</span>
                  </div>
                  <div className={styles.optionDesc}>
                    Custom days of the week when modules unlock.
                  </div>
                  {ruleAction === "week_days" && (
                    <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                      <div className={styles.daysGrid}>
                        {[
                          { label: "Sun", value: 0 },
                          { label: "Mon", value: 1 },
                          { label: "Tue", value: 2 },
                          { label: "Wed", value: 3 },
                          { label: "Thu", value: 4 },
                          { label: "Fri", value: 5 },
                          { label: "Sat", value: 6 }
                        ].map(d => (
                          <button 
                            key={d.value}
                            type="button"
                            className={`${styles.dayBtn} ${daysOfWeek.includes(d.value) ? styles.active : ""}`}
                            onClick={() => toggleDay(d.value)}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div 
                  className={`${styles.optionCard} ${ruleAction === "custom_interval" ? styles.selected : ""}`}
                  onClick={() => setRuleAction("custom_interval")}
                >
                  <div className={styles.optionHeader}>
                    <div className={styles.radio}></div>
                    <span className={styles.optionTitle}>X days interval</span>
                  </div>
                  <div className={styles.optionDesc}>
                    Custom days between unlocks, starting from today.
                  </div>
                  {ruleAction === "custom_interval" && (
                    <div className={styles.subConfig} onClick={e => e.stopPropagation()}>
                      <div className={styles.intervalInput}>
                        <input 
                          type="number" 
                          value={intervalDays}
                          min={1}
                          onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
                        />
                        <span>days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button 
              className={dashStyles.primaryBtn}
              onClick={handleUnifiedSubmit}
              disabled={isSubmitting || !batchCourseId}
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} />
                  Processing...
                </>
              ) : (
                'Assign Course & Apply Rules'
              )}
            </button>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: SEARCH, FILTER, STUDENT DIRECTORY */}
      <div className={styles.mainContent}>
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
        ) : (
          <div className={dashStyles.infoBox}>No students found matching your criteria.</div>
        )}
      </div>

      {/* Individual Rules Modal (for editing via details modal) */}
      {editingRulesFor && (
        <StudentRulesModal
          courseId={editingRulesFor.courseId}
          userId={editingRulesFor.userId}
          studentName={editingRulesFor.studentName}
          onClose={() => setEditingRulesFor(null)}
          onSuccess={() => {
            setEditingRulesFor(null);
            fetchStudents();
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
              <button onClick={() => setEditingEnrollment(null)} className={styles.closeBtn}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveEnrollmentDate} className={styles.modalBody}>
              <p>Change start date for <strong>{editingEnrollment.studentName}</strong> in <strong>{editingEnrollment.courseTitle}</strong></p>
              <input 
                type="date" 
                className={styles.dateInput}
                value={editingEnrollment.enrolledAt}
                onChange={(e) => setEditingEnrollment({ ...editingEnrollment, enrolledAt: e.target.value })}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="button" className={dashStyles.secondaryBtn} style={{ flex: 1 }} onClick={() => setEditingEnrollment(null)}>Cancel</button>
                <button type="submit" className={dashStyles.primaryBtn} style={{ flex: 1, justifyContent: 'center' }} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
