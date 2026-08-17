'use client';

import { useState, useEffect, useMemo } from 'react';
import Loader from "@/components/UI/Loader";
import Link from 'next/link';
import {
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle,
  Clock as ClockIcon,
  HelpCircle,
  Target,
  Play,
  RotateCcw,
  FileText,
  Lock,
  BookOpen,
  Folder
} from 'lucide-react';
import { formatDisplayDate } from '@/lib/date-format';
import styles from './QuizzesPage.module.css';

interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  status: string;
  allowMultipleAttempts: boolean;
  maxAttempts: number | null;
  attemptsCount: number;
  completedAttemptsCount?: number;
  topScore: number | null;
  avgScore: number | null;
  _count: { questions: number };
  courseId?: string | null;
  courseName?: string | null;
  courseSlug?: string | null;
  moduleName?: string | null;
  isLocked?: boolean;
  availableAt?: string | null;
  attempt?: {
    id: string;
    status: string;
    netScore?: number;
    score?: number;
    attemptNumber: number;
    submittedAt: string | null;
  } | null;
  latestCompletedAttempt?: {
    id: string;
    status: string;
    netScore?: number;
    score?: number;
    attemptNumber: number;
    submittedAt: string | null;
  } | null;
  firstAttemptScore?: number | null;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration' | 'alphabetical'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchQuizzes();
  }, [search, statusFilter, courseFilter, sortBy, page]);

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        sortBy: sortBy === 'newest' ? 'createdAt' : sortBy === 'oldest' ? 'createdAt' : sortBy === 'duration' ? 'durationMinutes' : 'title',
        sortOrder: sortBy === 'oldest' ? 'asc' : 'desc',
      });
      
      if (statusFilter) params.set('status', statusFilter);
      if (courseFilter) params.set('courseId', courseFilter);

      const res = await fetch(`/api/quiz?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch quizzes');
      
      setQuizzes(data.quizzes || []);
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (quiz: Quiz) => {
    if (quiz.isLocked) {
      return (
        <span className={`${styles.badge} ${styles.badgeLocked}`}>
          <Lock className={styles.badgeIcon} /> Locked
        </span>
      );
    }
    if (quiz.attempt?.status === 'in_progress') {
      return <span className={`${styles.badge} ${styles.inProgress}`}><ClockIcon className={styles.badgeIcon} /> In Progress</span>;
    }
    const hasCompleted = Boolean(
      quiz.latestCompletedAttempt || 
      (quiz.completedAttemptsCount && quiz.completedAttemptsCount > 0) ||
      quiz.topScore !== null || 
      (quiz.attempt && (quiz.attempt.status === 'submitted' || quiz.attempt.status === 'auto_submitted' || quiz.attempt.status === 'completed'))
    );
    if (hasCompleted) {
      return <span className={`${styles.badge} ${styles.completed}`}><CheckCircle className={styles.badgeIcon} /> Completed</span>;
    }
    return <span className={`${styles.badge} ${styles.notAttempted}`}><AlertCircle className={styles.badgeIcon} /> Available</span>;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins} mins` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  // Group unique courses for filter dropdown
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    quizzes.forEach(q => {
      if (q.courseId && q.courseName) {
        map.set(q.courseId, q.courseName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [quizzes]);

  // Group quizzes by course for organized display
  const courseGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quizzes: Quiz[] }>();
    quizzes.forEach(q => {
      const cId = q.courseId || 'general';
      const cName = q.courseName || 'Course Quizzes';
      if (!map.has(cId)) {
        map.set(cId, { id: cId, name: cName, quizzes: [] });
      }
      map.get(cId)!.quizzes.push(q);
    });
    return Array.from(map.values());
  }, [quizzes]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader variant="inline" text="Loading quizzes..." />
          <p>Loading quizzes from your enrolled courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Course Quizzes</h1>
        <p className={styles.subtitle}>Test your knowledge from your enrolled courses and modules</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search quizzes by title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          {uniqueCourses.length > 1 && (
            <select
              value={courseFilter}
              onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
              className={styles.filterSelect}
            >
              <option value="">All Enrolled Courses</option>
              {uniqueCourses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="available">Available (Unlocked)</option>
            <option value="locked">Locked (Coming Soon)</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
            className={styles.filterSelect}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="duration">Duration (Short to Long)</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className={styles.emptyState}>
          <Trophy className={styles.emptyIcon} />
          <h3>No quizzes available</h3>
          <p>Quizzes from your enrolled courses will appear here. If you just enrolled, check your courses in the study dashboard.</p>
        </div>
      ) : (
        <>
          <div className={styles.quizList}>
            {courseGroups.map(group => (
              <div key={group.id} className={styles.courseSection}>
                <div className={styles.courseHeader}>
                  <div className={styles.courseHeaderLeft}>
                    <BookOpen className={styles.courseHeaderIcon} />
                    <h2 className={styles.courseTitle}>{group.name}</h2>
                  </div>
                  <span className={styles.courseBadge}>
                    {group.quizzes.length} {group.quizzes.length === 1 ? 'Quiz' : 'Quizzes'}
                  </span>
                </div>

                {group.quizzes.map(quiz => {
                  const isLocked = Boolean(quiz.isLocked);
                  const isInProgress = !isLocked && quiz.attempt?.status === 'in_progress';
                  const hasCompletedAttempt = Boolean(
                    quiz.latestCompletedAttempt ||
                    (quiz.completedAttemptsCount && quiz.completedAttemptsCount > 0) ||
                    (quiz.attempt && (quiz.attempt.status === 'submitted' || quiz.attempt.status === 'auto_submitted' || quiz.attempt.status === 'completed'))
                  );
                  const resultAttemptId = quiz.latestCompletedAttempt?.id || (quiz.attempt?.status !== 'in_progress' ? quiz.attempt?.id : null);
                  
                  const canStart = !isLocked && !isInProgress && (
                    !quiz.attempt || (
                      quiz.allowMultipleAttempts && (
                        !quiz.maxAttempts || 
                        quiz.maxAttempts === 0 || 
                        (quiz.attemptsCount ?? 0) < quiz.maxAttempts
                      )
                    )
                  );
                  
                  return (
                    <div key={quiz.id} className={`${styles.quizCard} ${isLocked ? styles.cardLocked : ''}`}>
                      <div className={styles.quizInfo}>
                        {quiz.moduleName && (
                          <div className={styles.moduleTag}>
                            <Folder size={12} />
                            <span>{quiz.moduleName}</span>
                          </div>
                        )}

                        {isLocked ? (
                          <span className={styles.quizTitleLink} style={{ cursor: 'not-allowed' }}>
                            {quiz.title}
                          </span>
                        ) : (
                          <Link href={`/dashboard/quizzes/${quiz.id}`} className={styles.quizTitleLink}>
                            {quiz.title}
                          </Link>
                        )}

                        {quiz.description && (
                          <p className={styles.quizDesc}>{quiz.description}</p>
                        )}

                        <div className={styles.badgeWrapper}>
                          {getStatusBadge(quiz)}
                          {isLocked && quiz.availableAt && (
                            <span className={styles.unlockDateText}>
                              Unlocks: {formatDisplayDate(quiz.availableAt)} - 10:00 PM
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.quizStats}>
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <HelpCircle className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Questions</span>
                            <span className={styles.statValue}>{quiz.numQuestionsToServe}</span>
                          </div>
                        </div>
                        
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <ClockIcon className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Duration</span>
                            <span className={styles.statValue}>{quiz.durationMinutes === 0 ? 'Unlimited' : formatDuration(quiz.durationMinutes)}</span>
                          </div>
                        </div>
                        
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Target className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Attempts</span>
                            <span className={styles.statValue}>
                              {quiz.attemptsCount !== undefined ? quiz.attemptsCount : 0} {quiz.maxAttempts && quiz.maxAttempts > 0 ? `/ ${quiz.maxAttempts}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Top Score</span>
                            <span className={`${styles.statValue} ${quiz.topScore !== null ? styles.scoreValue : ''}`}>
                              {quiz.topScore !== null && quiz.topScore !== undefined ? `${quiz.topScore.toFixed(1)} Marks` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} style={{ opacity: 0.7 }} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Avg Score</span>
                            <span className={`${styles.statValue} ${quiz.avgScore !== null ? styles.scoreValue : ''}`}>
                              {quiz.avgScore !== null && quiz.avgScore !== undefined ? `${quiz.avgScore.toFixed(1)} Marks` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} style={{ opacity: 0.4 }} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>1st Attempt</span>
                            <span className={`${styles.statValue} ${quiz.firstAttemptScore !== null && quiz.firstAttemptScore !== undefined ? styles.scoreValue : ''}`}>
                              {quiz.firstAttemptScore !== null && quiz.firstAttemptScore !== undefined ? `${quiz.firstAttemptScore.toFixed(1)} Marks` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.quizActions}>
                        {isLocked ? (
                          <button disabled className={styles.lockedBtn} title="Module not yet unlocked">
                            <Lock size={14} /> Locked
                          </button>
                        ) : (
                          <>
                            {isInProgress && quiz.attempt?.id && (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}/attempt/${quiz.attempt.id}`}
                                className={`${styles.actionBtn} ${styles.continueBtn}`}
                                title="Continue Quiz"
                              >
                                <RotateCcw className={styles.btnIcon} /> Continue
                              </Link>
                            )}
                            {hasCompletedAttempt && resultAttemptId && (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}/result?attempt=${resultAttemptId}`}
                                className={`${styles.actionBtn} ${styles.resultBtn}`}
                                title="View Result"
                              >
                                <FileText className={styles.btnIcon} /> Result
                              </Link>
                            )}
                            {canStart && (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}`}
                                className={`${styles.actionBtn} ${styles.startBtn}`}
                                title={quiz.attemptsCount > 0 ? "Re-attempt Quiz" : "Start Quiz"}
                              >
                                <Play className={styles.btnIcon} /> {quiz.attemptsCount > 0 ? 'Re-attempt' : 'Start'}
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={styles.pageBtn}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={styles.pageBtn}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}