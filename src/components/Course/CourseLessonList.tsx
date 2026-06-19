import { PlayCircle, Clock, Video, FileText, Lock } from 'lucide-react';
import styles from './CourseLessonList.module.css';
import { CurriculumNode } from './CourseCurriculum';
import { formatDisplayDate } from '@/lib/date-format';

interface Props {
  curriculum: CurriculumNode[];
}

export default function CourseLessonList({ curriculum }: Props) {
  const lessons: CurriculumNode[] = [];
  
  const walk = (nodes: CurriculumNode[]) => {
    nodes.forEach(node => {
      if (node.type !== 'folder') {
        lessons.push(node);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    });
  };
  
  walk(curriculum);

  if (lessons.length === 0) {
    return <p className={styles.emptyState}>No lessons available yet.</p>;
  }

  const getAvailabilityLabel = (lesson: CurriculumNode) => {
    if (lesson.availableAt) {
      if (!lesson.locked) {
        return 'Available';
      }
      return `Available: ${formatDisplayDate(lesson.availableAt)}, 10:00 PM`;
    }
    return lesson.type === 'document' ? 'Document' : 'Video Lesson';
  };

  return (
    <div className={styles.container}>
      {lessons.map((lesson, index) => (
        <div 
          key={lesson.id || index} 
          className={`${styles.lessonCard} ${lesson.locked ? styles.lockedCard : ''}`}
        >
          <div className={styles.indexColumn}>
            <span className={styles.indexNumber}>
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          
          <div className={styles.contentColumn}>
            <h4 className={styles.title}>{lesson.title}</h4>
            <div className={styles.metaRow}>
              <div className={`${styles.metaBadge} ${lesson.availableAt && !lesson.locked ? styles.availableBadge : ''}`}>
                {lesson.type === 'document' ? <FileText size={14} /> : <Video size={14} />}
                <span>{getAvailabilityLabel(lesson)}</span>
              </div>
            </div>
          </div>
          
          {lesson.duration && (
            <div className={styles.durationColumn}>
              <div className={styles.durationBadge}>
                <Clock size={14} />
                <span>{lesson.duration}</span>
              </div>
            </div>
          )}
          
          <div className={styles.actionColumn}>
            <button 
              className={styles.playButton} 
              aria-label={lesson.locked ? "Locked" : "Preview Lesson"}
              disabled={lesson.locked}
            >
              {lesson.locked ? <Lock size={20} /> : <PlayCircle size={24} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
