'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Filter, ArrowUpDown, Clock, Trophy, AlertCircle, CheckCircle, Clock as ClockIcon, Loader2, HelpCircle, Target, Play, RotateCcw, FileText } from 'lucide-react';
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
  topScore: number | null;
  avgScore: number | null;
  _count: { questions: number };
  attempt?: {
    id: string;
    status: string;
    netScore: number;
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
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration' | 'alphabetical'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 12;

  useEffect(() => {
    fetchQuizzes();
  }, [search, statusFilter, sortBy, page]);

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
    if (quiz.attempt) {
      if (quiz.attempt.status === 'in_progress') {
        return <span className={`${styles.badge} ${styles.inProgress}`}><ClockIcon className={styles.badgeIcon} /> In Progress</span>;
      }
      if (quiz.attempt.status === 'submitted' || quiz.attempt.status === 'auto_submitted') {
        return <span className={`${styles.badge} ${styles.completed}`}><CheckCircle className={styles.badgeIcon} /> Completed</span>;
      }
    }
    return <span className={`${styles.badge} ${styles.notAttempted}`}><AlertCircle className={styles.badgeIcon} /> Not Attempted</span>;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader2 className={styles.spinner} />
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Available Quizzes</h1>
        <p className={styles.subtitle}>Test your knowledge and track your progress</p>
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
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="not_attempted">Not Attempted</option>
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
          <h3>No quizzes found</h3>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className={styles.quizList}>
            {quizzes.map(quiz => {
              const isInProgress = quiz.attempt?.status === 'in_progress';
              const isCompleted = quiz.attempt?.status === 'submitted' || quiz.attempt?.status === 'auto_submitted';
              
              const canStart = !isInProgress && (
                !quiz.attempt || (
                  quiz.allowMultipleAttempts && (
                    !quiz.maxAttempts || 
                    quiz.maxAttempts === 0 || 
                    (quiz.attempt?.attemptNumber ?? 0) < quiz.maxAttempts
                  )
                )
              );
              
              return (
                <div key={quiz.id} className={styles.quizCard}>
                  <div className={styles.quizInfo}>
                    <Link href={`/dashboard/quizzes/${quiz.id}`} className={styles.quizTitleLink}>
                      {quiz.title}
                    </Link>
                    {quiz.description && (
                      <p className={styles.quizDesc}>{quiz.description}</p>
                    )}
                    <div className={styles.badgeWrapper}>
                      {getStatusBadge(quiz)}
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
                          {quiz.topScore !== null && quiz.topScore !== undefined ? `${quiz.topScore.toFixed(1)}%` : '—'}
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
                          {quiz.avgScore !== null && quiz.avgScore !== undefined ? `${quiz.avgScore.toFixed(1)}%` : '—'}
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
                          {quiz.firstAttemptScore !== null && quiz.firstAttemptScore !== undefined ? `${quiz.firstAttemptScore.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.quizActions}>
                    {isInProgress && quiz.attempt?.id && (
                      <Link
                        href={`/dashboard/quizzes/${quiz.id}/attempt/${quiz.attempt.id}`}
                        className={`${styles.actionBtn} ${styles.continueBtn}`}
                        title="Continue Quiz"
                      >
                        <RotateCcw className={styles.btnIcon} /> Continue
                      </Link>
                    )}
                    {canStart && (
                      <Link
                        href={`/dashboard/quizzes/${quiz.id}`}
                        className={`${styles.actionBtn} ${styles.startBtn}`}
                        title="Start Quiz"
                      >
                        <Play className={styles.btnIcon} /> {quiz.attemptsCount > 0 ? 'Re-attempt' : 'Start'}
                      </Link>
                    )}
                    {isCompleted && quiz.attempt?.id && (
                      <Link
                        href={`/dashboard/quizzes/${quiz.id}/result?attempt=${quiz.attempt.id}`}
                        className={`${styles.actionBtn} ${styles.resultBtn}`}
                        title="View Result"
                      >
                        <FileText className={styles.btnIcon} /> Result
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
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