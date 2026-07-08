import { useState } from 'react';
import { PlayCircle, FileText, Lock, FolderOpen, Folder, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './CourseLessonList.module.css';
import { CurriculumNode } from './CourseCurriculum';

interface Props {
  curriculum: CurriculumNode[];
  hasAccess?: boolean;
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

function FolderAccordion({ node, hasAccess }: { node: CurriculumNode; hasAccess: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const locked = !hasAccess;
  const { videos, docs } = node.children ? countItems(node.children) : { videos: 0, docs: 0 };

  const toggle = () => {
    if (locked) return;
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={styles.folderAccordion}>
      <button
        className={`${styles.folderHeader} ${locked ? styles.folderLocked : ''}`}
        onClick={toggle}
        disabled={locked}
        aria-expanded={isOpen}
      >
        <div className={styles.folderHeaderLeft}>
          {isOpen && !locked ? (
            <FolderOpen size={18} className={styles.folderIconOpen} />
          ) : (
            <Folder size={18} className={styles.folderIconClosed} />
          )}
          <span className={styles.folderName}>{node.title}</span>
          {locked && <Lock size={14} className={styles.lockIcon} />}
        </div>
        <div className={styles.folderHeaderRight}>
          {!locked && (
            <span className={styles.itemCount}>
              {videos > 0 && `${videos} video${videos !== 1 ? 's' : ''}`}
              {videos > 0 && docs > 0 && ' · '}
              {docs > 0 && `${docs} doc${docs !== 1 ? 's' : ''}`}
            </span>
          )}
          <div className={styles.chevron}>
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {!locked && isOpen && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={styles.folderContent}
          >
            {node.children.map((child) => (
              <div key={child.id} className={styles.lessonRow}>
                <div className={styles.lessonRowLeft}>
                  {child.type === 'document' ? (
                    <FileText size={15} className={styles.docIcon} />
                  ) : (
                    <PlayCircle size={15} className={styles.playIcon} />
                  )}
                  <span className={styles.lessonTitle}>{child.title}</span>
                  {child.completed && <span className={styles.completedBadge}>Completed</span>}
                </div>
                {child.duration && <span className={styles.duration}>{child.duration}</span>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {locked && (
        <div className={styles.folderLockedHint}>
          Log in and enroll to access this content
        </div>
      )}
    </div>
  );
}

function FlatLessonRow({ node }: { node: CurriculumNode }) {
  return (
    <div className={styles.lessonRow}>
      <div className={styles.lessonRowLeft}>
        {node.type === 'document' ? (
          <FileText size={15} className={styles.docIcon} />
        ) : (
          <PlayCircle size={15} className={styles.playIcon} />
        )}
        <span className={styles.lessonTitle}>{node.title}</span>
        {node.completed && <span className={styles.completedBadge}>Completed</span>}
      </div>
      {node.duration && <span className={styles.duration}>{node.duration}</span>}
    </div>
  );
}

export default function CourseLessonList({ curriculum, hasAccess = false }: Props) {
  if (curriculum.length === 0) {
    return <p className={styles.emptyState}>No lessons available yet.</p>;
  }

  return (
    <div className={styles.container}>
      {curriculum.map((node) => {
        if (node.type === 'folder') {
          return <FolderAccordion key={node.id} node={node} hasAccess={hasAccess} />;
        }
        return <FlatLessonRow key={node.id} node={node} />;
      })}
    </div>
  );
}
