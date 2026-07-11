import { useState } from 'react';
import { PlayCircle, FileText, Lock, FolderOpen, Folder, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CourseLessonList.module.css';
import { CurriculumNode } from './CourseCurriculum';
import Link from 'next/link';

interface Props {
  curriculum: CurriculumNode[];
  hasAccess?: boolean;
  courseSlug?: string;
}

function countItems(nodes: CurriculumNode[]): { videos: number; docs: number } {
  let videos = 0;
  let docs = 0;
  for (const node of nodes) {
    if (node.type === 'folder' && node.children) {
      const inner = countItems(node.children);
      videos += inner.videos;
      docs += inner.docs;
    } else if (node.type === 'document') {
      docs++;
    } else {
      videos++;
    }
  }
  return { videos, docs };
}

function FolderAccordion({ node, hasAccess, courseSlug }: { node: CurriculumNode; hasAccess: boolean; courseSlug?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const isModuleLocked = !hasAccess || node.locked;
  const { videos, docs } = node.children ? countItems(node.children) : { videos: 0, docs: 0 };

  const toggle = () => {
    if (isModuleLocked) return;
    setIsOpen((prev) => !prev);
  };

  const formatDisplayDateLocal = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '';
    }
  };

  return (
    <div className={styles.folderAccordion}>
      <button
        className={`${styles.folderHeader} ${isModuleLocked ? styles.folderLocked : ''}`}
        onClick={toggle}
        disabled={isModuleLocked}
        aria-expanded={isOpen}
      >
        <div className={styles.folderHeaderLeft}>
          {isOpen && !isModuleLocked ? (
            <FolderOpen size={18} className={styles.folderIconOpen} />
          ) : (
            <Folder size={18} className={styles.folderIconClosed} />
          )}
          <span className={styles.folderName}>{node.title}</span>
          {isModuleLocked && <Lock size={14} className={styles.lockIcon} />}
        </div>
        <div className={styles.folderHeaderRight}>
          {!isModuleLocked && (
            <span className={styles.itemCount}>
              {videos > 0 && `${videos} video${videos !== 1 ? 's' : ''}`}
              {videos > 0 && docs > 0 && ' · '}
              {docs > 0 && `${docs} doc${docs !== 1 ? 's' : ''}`}
            </span>
          )}
          {node.locked && node.availableAt && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '8px' }}>
              {formatDisplayDateLocal(node.availableAt)} - 10:00 PM
            </span>
          )}
          {!isModuleLocked && (
            <div className={styles.chevron}>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          )}
        </div>
      </button>

      <AnimatePresence>
        {!isModuleLocked && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={styles.folderContent}
          >
            {node.children.map((child) => {
              const lessonLink = courseSlug ? `/study/${courseSlug}?lesson=${child.id}` : '#';
              const RowContent = (
                <>
                  <div className={styles.lessonRowLeft}>
                    {child.type === 'document' ? (
                      <FileText size={15} className={styles.docIcon} />
                    ) : (
                      <PlayCircle size={15} className={styles.playIcon} />
                    )}
                    <span className={styles.lessonTitle}>{child.title}</span>
                  </div>
                  {child.completed && <CheckCircle2 size={14} style={{ color: '#10b981', marginLeft: 'auto' }} />}
                </>
              );

              return hasAccess && courseSlug ? (
                <Link key={child.id} href={lessonLink} className={styles.lessonRow} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%', alignItems: 'center' }}>
                  {RowContent}
                </Link>
              ) : (
                <div key={child.id} className={styles.lessonRow}>
                  {RowContent}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {!hasAccess && (
        <div className={styles.folderLockedHint}>
          Log in and enroll to access this content
        </div>
      )}
    </div>
  );
}

function FlatLessonRow({ node, hasAccess, courseSlug }: { node: CurriculumNode; hasAccess: boolean; courseSlug?: string }) {
  const lessonLink = courseSlug ? `/study/${courseSlug}?lesson=${node.id}` : '#';
  const RowContent = (
    <>
      <div className={styles.lessonRowLeft}>
        {node.type === 'document' ? (
          <FileText size={15} className={styles.docIcon} />
        ) : (
          <PlayCircle size={15} className={styles.playIcon} />
        )}
        <span className={styles.lessonTitle}>{node.title}</span>
      </div>
      {node.completed && <CheckCircle2 size={14} style={{ color: '#10b981', marginLeft: 'auto' }} />}
    </>
  );

  return hasAccess && courseSlug ? (
    <Link href={lessonLink} className={styles.lessonRow} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', width: '100%', alignItems: 'center' }}>
      {RowContent}
    </Link>
  ) : (
    <div className={styles.lessonRow}>
      {RowContent}
    </div>
  );
}

export default function CourseLessonList({ curriculum, hasAccess = false, courseSlug }: Props) {
  if (curriculum.length === 0) {
    return <p className={styles.emptyState}>No lessons available yet.</p>;
  }

  return (
    <div className={styles.container}>
      {curriculum.map((node) => {
        if (node.type === 'folder') {
          return <FolderAccordion key={node.id} node={node} hasAccess={hasAccess} courseSlug={courseSlug} />;
        }
        return <FlatLessonRow key={node.id} node={node} hasAccess={hasAccess} courseSlug={courseSlug} />;
      })}
    </div>
  );
}
