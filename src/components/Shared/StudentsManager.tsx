'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { 
  Search, Loader2, Edit, Trash2, MailCheck, GraduationCap, X, 
  User, Mail, Phone, FileText, ImagePlus, Send, Calendar, CheckSquare, Square
} from 'lucide-react';
import dashStyles from '@/app/admin/dashboard/AdminDashboard.module.css';
import styles from './StudentsManager.module.css';

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
  emailVerified?: boolean;
  enrolledCourses: EnrolledCourse[];
}

export default function StudentsManager() {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchEnrollDate, setBatchEnrollDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentProfile | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentProfile | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<{
    studentName: string;
    courseTitle: string;
    orderId: string;
    enrolledAt: string;
  } | null>(null);

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
      const res = await fetch('/api/admin/courses', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok && data.courses) {
        setCourses(data.courses);
      }
    } catch (err) {
      console.error('Failed to fetch courses', err);
    }
  }, [token]);

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
    return name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => 
      s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [students, searchQuery]);

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
    if (selectedIds.size === filteredStudents.length) {
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
    } catch (err) {
      alert('Network error while processing batch enrollment.');
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
        alert(data.error || 'Failed to update enrollment date.');
      }
    } catch (err) {
      alert('Network error while updating enrollment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Student Manager Standard Handlers (Invite, Edit, Delete, Confirm)
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
        showMessage({ type: 'success', text: 'Student updated successfully.' });
        setTimeout(() => {
          setEditStudent(null);
          fetchStudents();
        }, 1500);
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

  const handleConfirmEmail = async (student: StudentProfile) => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/students/manage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: student.id, emailVerified: true }),
      });
      const data = await res.json();

      if (res.ok) {
        showMessage({ type: 'success', text: data.message || `${student.fullName}'s email has been confirmed.` });
        fetchStudents();
      } else {
        showMessage({ type: 'error', text: data.error || 'Failed to confirm email.' });
      }
    } catch (err) {
      showMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedBatchExpiry = useMemo(() => {
    if (!batchEnrollDate) return '';
    try {
      const d = new Date(batchEnrollDate);
      d.setFullYear(d.getFullYear() + 1);
      return d.toLocaleDateString('en-GB');
    } catch {
      return '';
    }
  }, [batchEnrollDate]);

  const calculatedEditExpiry = useMemo(() => {
    if (!editingEnrollment?.enrolledAt) return '';
    try {
      const d = new Date(editingEnrollment.enrolledAt);
      d.setFullYear(d.getFullYear() + 1);
      return d.toLocaleDateString('en-GB');
    } catch {
      return '';
    }
  }, [editingEnrollment?.enrolledAt]);

  return (
    <div className={styles.wrapper}>
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
        <button className={dashStyles.primaryBtn} onClick={() => { 
          setFormData({ fullName: '', email: '', phone: '', bmdcNumber: '', profileImage: '' }); 
          setMessage(null);
          setIsAddOpen(true); 
        }}>
          <GraduationCap size={16} /> New Student
        </button>
      </div>

      {loading ? (
        <div className={dashStyles.loader}>
          <Loader2 className={dashStyles.spinner} />
          Loading students...
        </div>
      ) : filteredStudents.length > 0 ? (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <button 
                      onClick={handleToggleSelectAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', padding: 0 }}
                    >
                      {selectedIds.size === filteredStudents.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th>Student</th>
                  <th>Details</th>
                  <th>Programs Enrolled</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>📱 {student.phone || 'No phone'}</span>
                        {student.bmdcNumber && <span>📋 BM&DC: {student.bmdcNumber}</span>}
                        <span style={{ fontSize: '0.75rem', marginTop: '2px' }}>Joined {new Date(student.createdAt).toLocaleDateString('en-GB')}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '260px' }}>
                        {student.enrolledCourses.length > 0 ? (
                          student.enrolledCourses.map((c) => (
                            <div key={c.courseId} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '8px 10px',
                              background: 'var(--surface-soft)',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              border: '1px solid var(--glass-border)'
                            }}>
                              <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{c.courseTitle}</span>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', gap: '4px' }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Start: {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString('en-GB') : '—'}
                                </span>
                                <button 
                                  className={styles.editDateBtn} 
                                  title="Edit Enrollment Date"
                                  onClick={() => setEditingEnrollment({
                                    studentName: student.fullName,
                                    courseTitle: c.courseTitle,
                                    orderId: c.orderId,
                                    enrolledAt: c.enrolledAt ? new Date(c.enrolledAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  })}
                                >
                                  <Calendar size={13} />
                                </button>
                              </div>
                              {c.expiresAt && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  Expires: {new Date(c.expiresAt).toLocaleDateString('en-GB')}
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No courses</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!student.emailVerified && (
                          <button className={dashStyles.actionBtn} onClick={() => handleConfirmEmail(student)} title="Confirm email" disabled={isSubmitting}><MailCheck size={16} /></button>
                        )}
                        <button className={dashStyles.actionBtn} onClick={() => { setFormData({ fullName: student.fullName, email: student.email, phone: student.phone || '', bmdcNumber: student.bmdcNumber || '', profileImage: student.profileImage || '' }); setEditStudent(student); setMessage(null); }} title="Edit Profile"><Edit size={16} /></button>
                        <button className={`${dashStyles.actionBtn} ${dashStyles.danger}`} onClick={() => setDeleteStudent(student)} title="Delete"><Trash2 size={16} /></button>
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
                >
                  <option value="">-- Select Program to Enroll --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={styles.batchText} style={{ fontSize: '0.8rem' }}>Enrolled On:</span>
                  <input 
                    type="date" 
                    className={styles.dateInput}
                    value={batchEnrollDate}
                    onChange={(e) => setBatchEnrollDate(e.target.value)}
                  />
                  {batchEnrollDate && (
                    <span className={styles.expiryPreview}>
                      (Expires: {calculatedBatchExpiry})
                    </span>
                  )}
                </div>
              </div>
              <button 
                className={dashStyles.primaryBtn}
                onClick={handleBatchEnrollSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enrolling...' : 'Batch Enroll'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={dashStyles.infoBox}>No students found matching your criteria.</div>
      )}

      {/* EDIT ENROLLMENT DATE MODAL */}
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
                  {isSubmitting ? 'Saving...' : 'Save Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STUDENT MODAL */}
      {isAddOpen && (
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} glass`}>
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
        <div className={styles.modalBackdrop}>
          <div className={`${styles.modal} glass`}>
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
    </div>
  );
}
