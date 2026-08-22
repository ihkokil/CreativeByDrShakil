'use client';

import { useEffect, useState, useMemo } from 'react';
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
  Zap,
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

interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  score: number;
  percentageScore: number;
  timeTakenSeconds: number;
  attemptNumber: number;
  submittedAt: string;
  isCurrentUser: boolean;
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

export default function ReviewAttemptsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;
  const initialTab = searchParams ? searchParams.get('tab') : null;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'attempts' | 'leaderboard'>(
    initialTab === 'leaderboard' ? 'leaderboard' : 'attempts'
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

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
        setLeaderboard(data.leaderboard || []);
        setUserRank(data.userRank || null);
        setTotalParticipants(data.totalParticipants || 0);
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
    if (!minutes || minutes === 0) return 'Unlimited';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins} mins` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Completed attempts only for metrics
  const completedAttempts = useMemo(() => {
    return attempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted');
  }, [attempts]);

  const inProgressAttempt = useMemo(() => {
    return attempts.find(a => a.status === 'in_progress');
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

    const scores = completedAttempts
      .map(a => (a.netScore !== null && a.netScore !== undefined ? Number(a.netScore) : NaN))
      .filter(s => !isNaN(s));

    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const bestAttempt = completedAttempts.find(a => Number(a.netScore) === bestScore);
    const avgScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null;

    const firstAtt = completedAttempts.find(a => a.attemptNumber === 1);
    const firstAttemptScore = firstAtt && firstAtt.netScore !== null && firstAtt.netScore !== undefined ? Number(firstAtt.netScore) : null;

    const times = completedAttempts
      .map(a => Number(a.timeTakenSeconds || 0))
      .filter(t => t > 0);
    const bestTimeSeconds = times.length > 0 ? Math.min(...times) : null;

    return {
      bestScore,
      bestScoreAttemptId: bestAttempt?.id || null,
      avgScore,
      firstAttemptScore,
      bestTimeSeconds,
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

      {/* Tabs Switcher */}
      <div className={styles.tabsContainer}>
        <button
          onClick={() => setActiveTab('attempts')}
          className={`${styles.tabBtn} ${activeTab === 'attempts' ? styles.activeTabBtn : ''}`}
        >
          <RotateCcw size={16} /> Past Attempts ({attempts.length})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`${styles.tabBtn} ${activeTab === 'leaderboard' ? styles.activeTabBtn : ''}`}
        >
          <Trophy size={16} /> Leaderboard & Rankings ({leaderboard.length})
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <div className={styles.leaderboardCard}>
          <div className={styles.leaderboardTopBanner}>
            <div className={styles.policyBadge}>
              <Award size={16} style={{ color: '#f59e0b' }} />
              <span>
                Ranking Policy: <strong>{quiz.positionType === 'first_attempt' ? 'First Attempt Score' : 'Highest Score Across All Attempts'}</strong>
              </span>
            </div>
            {userRank !== null && (
              <div className={styles.userRankHighlight}>
                <Trophy size={15} />
                <span>Your Rank: #{userRank} of {totalParticipants}</span>
              </div>
            )}
          </div>

          {leaderboard.length === 0 ? (
            <div className={styles.emptyState}>
              <Trophy className={styles.emptyIcon} />
              <h3>No Leaderboard Entries Yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Be the first student to complete this quiz and claim the top rank!
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.leaderboardTable}>
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Attempt</th>
                    <th>Time Taken</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isRank1 = entry.rank === 1;
                    const isRank2 = entry.rank === 2;
                    const isRank3 = entry.rank === 3;
                    const rankClass = isRank1 ? styles.rank1 : isRank2 ? styles.rank2 : isRank3 ? styles.rank3 : '';

                    return (
                      <tr 
                        key={entry.studentId}
                        className={`${styles.leaderboardRow} ${entry.isCurrentUser ? styles.currentUserRow : ''}`}
                      >
                        <td className={styles.rankCell}>
                          <span className={`${styles.rankBadge} ${rankClass}`}>
                            {isRank1 ? '🥇' : isRank2 ? '🥈' : isRank3 ? '🥉' : `#${entry.rank}`}
                          </span>
                        </td>
                        <td className={styles.studentCell}>
                          <div className={styles.studentInfo}>
                            <div className={styles.studentAvatar}>
                              {entry.studentName.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.studentName}>
                              <span>{entry.studentName}</span>
                              {entry.isCurrentUser && (
                                <span className={styles.youBadge}>You</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={styles.scoreCell}>
                          <div className={styles.scorePrimary}>
                            <span>{Number(entry.score).toFixed(1)}</span>
                            <span className={styles.scorePct}>
                              ({entry.percentageScore}%)
                            </span>
                          </div>
                        </td>
                        <td className={styles.attemptCell}>
                          Attempt #{entry.attemptNumber}
                        </td>
                        <td className={styles.timeCell}>
                          {formatTime(entry.timeTakenSeconds)}
                        </td>
                        <td className={styles.dateCell}>
                          {entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
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
                You haven't completed any attempts for this quiz yet. Start now to test your medical knowledge!
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
                                -{attempt.negativeMarks.toFixed(2)} Penalty
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
        </>
      )}
    </div>
  );
}
