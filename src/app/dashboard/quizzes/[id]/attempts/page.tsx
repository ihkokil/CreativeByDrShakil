'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Play,
  RotateCcw,
  FileText,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react';
import styles from './page.module.css';

interface AttemptItem {
  id: string;
  attemptNumber: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  timeTakenSeconds: number | null;
  netScore: number | null;
  percentageScore: number | null;
  correctCount?: number | null;
  wrongCount?: number | null;
  skippedCount?: number | null;
  negativeMarks?: number | null;
}

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  totalMarks?: number;
  category?: { displayName: string } | null;
  allowMultipleAttempts: boolean;
  maxAttempts: number | null;
  positionType: string;
}

function ReviewAttemptsContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Seamless redirect if legacy link or bookmark has ?tab=leaderboard
  useEffect(() => {
    const tab = searchParams ? searchParams.get('tab') : null;
    if (tab === 'leaderboard') {
      const query = new URLSearchParams();
      const scrollToRank = searchParams?.get('scrollToRank');
      if (scrollToRank) query.set('scrollToRank', scrollToRank);
      if (returnUrl) query.set('returnUrl', returnUrl);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      router.replace(`/dashboard/quizzes/${quizId}/leaderboard${queryString}`);
    }
  }, [searchParams, router, quizId, returnUrl]);

  useEffect(() => {
    const fetchQuizAndAttempts = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}`, { cache: 'no-store' });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403) {
            router.push(returnUrl || '/dashboard/quizzes');
            return;
          }
          throw new Error(data.error || 'Failed to load quiz attempts');
        }

        setQuiz(data.quiz);
        setAttempts(data.allAttempts || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizAndAttempts();
  }, [quizId, router, returnUrl]);

  const handleStartQuiz = async () => {
    if (!quiz) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/start`, { method: 'POST' });
      const data = await res.json();

      const targetAttemptId = data.attemptId;
      if (!res.ok && !targetAttemptId) {
        throw new Error(data.error || 'Failed to start quiz');
      }

      const targetUrl = returnUrl
        ? `/dashboard/quizzes/${quizId}/attempt/${targetAttemptId}?returnUrl=${encodeURIComponent(returnUrl)}`
        : `/dashboard/quizzes/${quizId}/attempt/${targetAttemptId}`;
      router.push(targetUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to start quiz');
    } finally {
      setStarting(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '0 mins';
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const remMins = minutes % 60;
      return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs} hr${hrs > 1 ? 's' : ''}`;
    }
    return `${minutes} min${minutes > 1 ? 's' : ''}`;
  };

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const inProgressAttempt = useMemo(() => {
    return attempts.find(a => a.status === 'in_progress');
  }, [attempts]);

  const completedAttempts = useMemo(() => {
    return attempts.filter(a => a.status === 'completed');
  }, [attempts]);

  const stats = useMemo(() => {
    if (completedAttempts.length === 0) {
      return {
        bestScore: null,
        bestScoreAttemptId: null,
        avgScore: null,
        firstAttemptScore: null,
        bestTimeSeconds: null,
      };
    }

    let bestScore = -Infinity;
    let bestAttemptId: string | null = null;
    let totalScore = 0;
    let bestTimeSeconds = Infinity;

    for (const att of completedAttempts) {
      const score = Number(att.netScore || 0);
      if (score > bestScore) {
        bestScore = score;
        bestAttemptId = att.id;
      }
      totalScore += score;
      if (att.timeTakenSeconds && att.timeTakenSeconds < bestTimeSeconds) {
        bestTimeSeconds = att.timeTakenSeconds;
      }
    }

    const avgScore = totalScore / completedAttempts.length;
    const sortedByNumber = [...completedAttempts].sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0));
    const firstAttemptScore = sortedByNumber[0] ? Number(sortedByNumber[0].netScore || 0) : null;

    return {
      bestScore,
      bestScoreAttemptId: bestAttemptId,
      avgScore,
      firstAttemptScore,
      bestTimeSeconds: bestTimeSeconds === Infinity ? null : bestTimeSeconds,
    };
  }, [completedAttempts]);

  const totalQuizMarks = quiz?.totalMarks || (quiz ? quiz.numQuestionsToServe * 2 : 0);

  const canRetake = !inProgressAttempt && quiz && (
    quiz.allowMultipleAttempts && (
      !quiz.maxAttempts || 
      quiz.maxAttempts === 0 || 
      completedAttempts.length < quiz.maxAttempts
    )
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading your past attempts...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <AlertCircle className={styles.emptyIcon} style={{ color: '#ef4444' }} />
          <h2>Unable to Load Quiz</h2>
          <p>{error || 'Quiz not found or access denied.'}</p>
          <Link href={returnUrl || '/dashboard/quizzes'} className={styles.secondaryBtn} style={{ marginTop: '16px' }}>
            <ChevronLeft className={styles.backIcon} />
            {returnUrl ? 'Back to Course' : 'Back to Quizzes'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href={returnUrl || '/dashboard/quizzes'} className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
        </Link>

        <div className={styles.headerTop}>
          <div className={styles.quizInfo}>
            <div className={styles.quizTitleRow}>
              <h1 className={styles.quizTitle}>{quiz.title}</h1>
              {quiz.category && (
                <span className={styles.categoryBadge}>{quiz.category.displayName}</span>
              )}
            </div>
            {quiz.description && <p className={styles.description}>{quiz.description}</p>}
          </div>

          <div className={styles.headerActions}>
            <Link
              href={`/dashboard/quizzes/${quizId}/leaderboard${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
              className={`${styles.actionBtn} ${styles.secondaryBtn}`}
              title="View the dedicated live leaderboard and rankings"
            >
              <Trophy size={16} />
              <span>View Leaderboard</span>
            </Link>

            {inProgressAttempt ? (
              <Link
                href={`/dashboard/quizzes/${quizId}/attempt/${inProgressAttempt.id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
                style={{ background: '#f59e0b' }}
              >
                <Play size={16} /> Continue In-Progress Quiz
              </Link>
            ) : canRetake ? (
              <button
                onClick={handleStartQuiz}
                disabled={starting}
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
              >
                <RotateCcw size={16} />
                {starting ? 'Starting...' : 'Take New Attempt'}
              </button>
            ) : null}

            <Link
              href={`/dashboard/quizzes/${quizId}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
              className={`${styles.actionBtn} ${styles.secondaryBtn}`}
            >
              <FileText size={16} /> Quiz Overview
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Performance Summary Cards */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Target size={22} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Total Attempts</span>
            <span className={styles.statValue}>
              {completedAttempts.length} {quiz.maxAttempts && quiz.maxAttempts > 0 ? `/ ${quiz.maxAttempts}` : ''}
            </span>
            <span className={styles.statSubtext}>{quiz.allowMultipleAttempts ? 'Retakes enabled' : '1 attempt allowed'}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Trophy size={22} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Best Score</span>
            <span className={styles.statValue} style={{ color: '#10b981' }}>
              {stats.bestScore !== null ? `${stats.bestScore.toFixed(1)} Marks` : '—'}
            </span>
            <span className={styles.statSubtext}>
              {totalQuizMarks > 0 && stats.bestScore !== null 
                ? `${Math.round((stats.bestScore / totalQuizMarks) * 100)}% of ${totalQuizMarks}m` 
                : 'No submissions yet'}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#a855f7' }}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Average Score</span>
            <span className={styles.statValue}>
              {stats.avgScore !== null ? `${stats.avgScore.toFixed(1)} Marks` : '—'}
            </span>
            <span className={styles.statSubtext}>Across all attempts</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Award size={22} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>1st Attempt Score</span>
            <span className={styles.statValue}>
              {stats.firstAttemptScore !== null ? `${stats.firstAttemptScore.toFixed(1)} Marks` : '—'}
            </span>
            <span className={styles.statSubtext}>Baseline benchmark</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrap} style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
            <Clock size={22} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Best Time</span>
            <span className={styles.statValue}>
              {stats.bestTimeSeconds !== null ? formatTime(stats.bestTimeSeconds) : '—'}
            </span>
            <span className={styles.statSubtext}>Duration: {formatDuration(quiz.durationMinutes)}</span>
          </div>
        </div>
      </section>

      {/* Attempts List */}
      <div className={styles.sectionTitleRow}>
        <h2 className={styles.sectionTitle}>
          <FileText size={20} style={{ color: 'var(--primary-color)' }} />
          Past Attempts History ({attempts.length})
        </h2>
        <span className={styles.sectionHint}>
          Click <strong>View Details</strong> to review question answers, explanations, and score analysis.
        </span>
      </div>

      {attempts.length === 0 ? (
        <div className={styles.emptyState}>
          <Trophy className={styles.emptyIcon} />
          <h3>No attempts recorded yet</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            You haven&apos;t completed any attempts for this quiz yet. Start now to test your medical knowledge!
          </p>
          <button onClick={handleStartQuiz} disabled={starting} className={`${styles.actionBtn} ${styles.primaryBtn}`}>
            <Play size={16} /> Start Quiz Now
          </button>
        </div>
      ) : (
        <div className={styles.attemptsList}>
          {attempts.map((attempt, idx) => {
            const attemptNum = attempt.attemptNumber || (attempts.length - idx);
            const isBest = stats.bestScoreAttemptId === attempt.id && completedAttempts.length > 1;
            const isLatest = idx === 0;
            const isInProg = attempt.status === 'in_progress';
            const netScore = Number(attempt.netScore || 0);
            const timeStr = formatTime(attempt.timeTakenSeconds);
            const percentage = attempt.percentageScore !== null && attempt.percentageScore !== undefined
              ? attempt.percentageScore
              : (totalQuizMarks > 0 ? Math.round((netScore / totalQuizMarks) * 100) : 0);

            const resultUrl = `/dashboard/quizzes/${quizId}/result?attempt=${attempt.id}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;

            return (
              <article key={attempt.id} className={styles.attemptCard}>
                <div className={styles.attemptCardTop}>
                  <div className={styles.attemptMeta}>
                    <span className={styles.attemptBadge}>
                      Attempt #{attemptNum}
                    </span>

                    {isBest && (
                      <span className={styles.bestBadge}>
                        <Trophy size={13} /> Best Score
                      </span>
                    )}

                    {isLatest && !isBest && (
                      <span className={styles.latestBadge}>
                        Latest Attempt
                      </span>
                    )}

                    {isInProg && (
                      <span style={{ 
                        padding: '4px 10px', 
                        background: 'rgba(245, 158, 11, 0.15)', 
                        color: '#f59e0b', 
                        borderRadius: '6px', 
                        fontSize: '12px', 
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b' }}></span>
                        In Progress
                      </span>
                    )}

                    <span className={styles.attemptDate}>
                      <Clock size={14} />
                      {new Date(attempt.submittedAt || attempt.startedAt).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>

                  {!isInProg && (
                    <div className={styles.attemptScoreWrap}>
                      <span className={styles.scoreNumber}>
                        {netScore.toFixed(2)}
                      </span>
                      <span className={styles.totalMarks}>
                        / {totalQuizMarks.toFixed(1)} Marks
                      </span>
                      <span className={styles.percentageBadge}>
                        {percentage}%
                      </span>
                    </div>
                  )}
                </div>

                <div className={styles.attemptDetailsRow}>
                  <div className={styles.chipsList}>
                    {!isInProg ? (
                      <>
                        {attempt.correctCount !== undefined && attempt.correctCount !== null && (
                          <span className={`${styles.chip} ${styles.chipCorrect}`}>
                            <CheckCircle size={14} /> {attempt.correctCount} Correct
                          </span>
                        )}

                        {attempt.wrongCount !== undefined && attempt.wrongCount !== null && attempt.wrongCount > 0 && (
                          <span className={`${styles.chip} ${styles.chipWrong}`}>
                            <XCircle size={14} /> {attempt.wrongCount} Wrong
                          </span>
                        )}

                        {attempt.skippedCount !== undefined && attempt.skippedCount !== null && attempt.skippedCount > 0 && (
                          <span className={styles.chip}>
                            <AlertCircle size={14} /> {attempt.skippedCount} Skipped
                          </span>
                        )}

                        {attempt.negativeMarks !== undefined && attempt.negativeMarks !== null && attempt.negativeMarks > 0 && (
                          <span className={`${styles.chip} ${styles.chipPenalty}`}>
                            -{attempt.negativeMarks.toFixed(2)} Negative Marks
                          </span>
                        )}

                        <span className={`${styles.chip} ${styles.chipTime}`}>
                          <Clock size={14} /> Time: {timeStr}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '13.5px', color: '#f59e0b' }}>
                        This attempt is still active and has not been submitted yet.
                      </span>
                    )}
                  </div>

                  <div>
                    {isInProg ? (
                      <Link
                        href={`/dashboard/quizzes/${quizId}/attempt/${attempt.id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                        className={styles.viewDetailsBtn}
                        style={{ background: '#f59e0b', color: '#ffffff', borderColor: '#f59e0b' }}
                      >
                        <Play size={15} /> Continue Attempt <ChevronRight size={16} />
                      </Link>
                    ) : (
                      <Link
                        href={resultUrl}
                        className={styles.viewDetailsBtn}
                      >
                        View Details <ChevronRight size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReviewAttemptsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading your past attempts...</p>
          </div>
        </div>
      }
    >
      <ReviewAttemptsContent />
    </Suspense>
  );
}
