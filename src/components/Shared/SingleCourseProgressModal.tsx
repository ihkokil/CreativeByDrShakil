'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Loader2, Folder, Calendar, Settings, XCircle, Mail, Phone, FileText
} from 'lucide-react';
import styles from './SingleCourseProgressModal.module.css';
import { formatDateGMT6 } from '@/lib/date-format';

interface BuilderNode {
  id: string;
  type: 'folder' | 'video' | 'pdf' | 'doc' | 'quiz' | 'html' | 'link' | 'embed';
  title: string;
  locked?: boolean;
  availableAt?: string | null;
  children?: BuilderNode[];
  completed?: boolean;
}

interface SingleCourseProgressModalProps {
  student: any;
  courseId: string;
  courseTitle: string;
  enrolledAt: string | null;
  expiresAt: string | null;
  onClose: () => void;
  onEditDate: () => void;
  onEditRules: () => void;
  onRevoke: () => void;
}

export default function SingleCourseProgressModal({
  student,
  courseId,
  courseTitle,
  enrolledAt,
  expiresAt,
  onClose,
  onEditDate,
  onEditRules,
  onRevoke
}: SingleCourseProgressModalProps) {
  const [data, setData] = useState<{ course: any, curriculum: BuilderNode[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCourseData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/teacher/students/${student.id}/courses/${courseId}/curriculum`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Failed to fetch course details');
        }
        
        if (isMounted) {
          setData(result);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCourseData();
    return () => { isMounted = false; };
  }, [student.id, courseId]);

  const calculateProgress = (nodes: BuilderNode[]): { completed: number, total: number } => {
    let completed = 0;
    let total = 0;
    const traverse = (n: BuilderNode[]) => {
      for (const node of n) {
        if (node.type === 'folder') {
          if (node.children) traverse(node.children);
        } else {
          total++;
          if (node.completed) completed++;
        }
      }
    };
    traverse(nodes);
    return { completed, total };
  };

  const progressStats = data ? calculateProgress(data.curriculum) : { completed: 0, total: 0 };
  const progressPercent = progressStats.total > 0 ? Math.round((progressStats.completed / progressStats.total) * 100) : 0;

  const renderFolder = (node: BuilderNode) => {
    let statusText = 'Available';
    let isLocked = !!node.locked;
    
    if (isLocked) {
      if (node.availableAt) {
        statusText = `Available on ${formatDateGMT6(node.availableAt)}`;
      } else {
        statusText = 'Locked';
      }
    }

    return (
      <div key={node.id} className={styles.accordionItem}>
        <div className={styles.accordionHeader} style={{ cursor: 'default' }}>
          <div className={styles.accordionTitle}>
            <Folder size={18} style={{ color: 'var(--primary)' }} />
            {node.title}
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isLocked ? 'var(--text-muted)' : '#10b981' }}>
            {statusText}
          </div>
        </div>
      </div>
    );
  };

  const topLevelFolders = data?.curriculum?.filter(n => n.type === 'folder') || [];

  const getInitials = (name: string) => {
    if (!name) return 'S';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <motion.div 
        className={styles.modal} 
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {student.profileImage ? (
              <img src={student.profileImage} alt={student.fullName} className={styles.studentAvatar} />
            ) : (
              <div className={styles.studentAvatar}>{getInitials(student.fullName)}</div>
            )}
            
            <div className={styles.studentInfoCol}>
              <h2 className={styles.studentName}>{student.fullName}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                <span className={styles.studentEmail} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={12} /> {student.email}
                </span>
                {student.phone && (
                  <span className={styles.studentEmail} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={12} /> {student.phone}
                  </span>
                )}
                {student.bmdcNumber && (
                  <span className={styles.studentEmail} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} /> {student.bmdcNumber}
                  </span>
                )}
              </div>
              
              <div className={styles.courseBadge}>
                <Folder size={14} />
                {courseTitle}
              </div>

              <div className={styles.studentInfo}>
                <span><Calendar size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> Enrolled: {enrolledAt ? formatDateGMT6(enrolledAt) : '—'}</span>
                <span style={{ color: 'var(--border)' }}>|</span>
                <span><Settings size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> Expires: {expiresAt ? formatDateGMT6(expiresAt) : '—'}</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '16px', zIndex: 1 }}>
            <button className={styles.closeBtn} onClick={onClose}><X size={18} /></button>
            {!loading && !error && progressStats.total > 0 && (
              <div className={styles.progressPill}>
                <span>{progressPercent}%</span>
                <span style={{ fontWeight: 500, opacity: 0.8, fontSize: '0.75rem' }}>({progressStats.completed}/{progressStats.total} modules)</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={32} className="animate-spin" style={{ marginBottom: '12px' }} />
              Loading course modules...
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              <XCircle size={48} style={{ color: '#ef4444', marginBottom: '12px' }} />
              <h3>Error</h3>
              <p>{error}</p>
            </div>
          ) : topLevelFolders.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topLevelFolders.map(node => renderFolder(node))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <Folder size={48} style={{ marginBottom: '12px' }} />
              <h3>Empty Course</h3>
              <p>This course does not have any modules yet.</p>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.footerBtn} onClick={onEditDate}>
            <Calendar size={16} /> Change Enrollment Date
          </button>
          <button className={styles.footerBtn} onClick={onEditRules}>
            <Settings size={16} /> Module Rules
          </button>
          <button className={`${styles.footerBtn} ${styles.danger}`} onClick={onRevoke}>
            <XCircle size={16} /> Revoke Access
          </button>
        </div>
      </motion.div>
    </div>
  );
}
