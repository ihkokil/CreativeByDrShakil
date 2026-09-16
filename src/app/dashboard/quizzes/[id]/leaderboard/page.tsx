'use client';

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  ChevronLeft,
  Play,
  RotateCcw,
  FileText,
  Award,
  Target,
  AlertCircle,
  Search,
  X,
} from 'lucide-react';
import styles from './page.module.css';

interface AttemptItem {
  id: string;
  attemptNumber: number;
  status: string;
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

function LeaderboardContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Infinite Scrolling & Smooth Scroll
  const [leaderboardVisibleCount, setLeaderboardVisibleCount] = useState<number>(30);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    const fetchQuizAndLeaderboard = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}`, { cache: 'no-store' });
        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403) {
            router.push(returnUrl || '/dashboard/quizzes');
            return;
          }
          throw new Error(data.error || 'Failed to load leaderboard');
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

    fetchQuizAndLeaderboard();
  }, [quizId, router, returnUrl]);

  const currentUserRankIndex = useMemo(() => {
    return leaderboard.findIndex(e => e.isCurrentUser);
  }, [leaderboard]);

  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const term = searchQuery.toLowerCase().trim();
    return leaderboard.filter(entry => entry.studentName.toLowerCase().includes(term));
  }, [leaderboard, searchQuery]);

  const displayedLeaderboard = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredLeaderboard;
    }
    return leaderboard.slice(0, leaderboardVisibleCount);
  }, [filteredLeaderboard, leaderboard, leaderboardVisibleCount, searchQuery]);

  const scrollToMyRank = useCallback((manualClick = false) => {
    if (currentUserRankIndex < 0) return;
    const currentStudent = leaderboard[currentUserRankIndex];
    if (!currentStudent) return;

    // Reset search if active so student is visible
    if (searchQuery.trim()) {
      setSearchQuery('');
    }

    // Expand visible count if student is beyond current batch
    if (currentUserRankIndex >= leaderboardVisibleCount) {
      setLeaderboardVisibleCount(Math.min(leaderboard.length, currentUserRankIndex + 20));
    }

    setTimeout(() => {
      const rowEl = document.getElementById(`leaderboard-row-${currentStudent.studentId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedStudentId(currentStudent.studentId);
        setTimeout(() => {
          setHighlightedStudentId(null);
        }, 3500);
      }
    }, 120);
  }, [currentUserRankIndex, leaderboard, leaderboardVisibleCount, searchQuery]);

  // Handle auto-scroll if redirected with ?scrollToRank=true
  useEffect(() => {
    const shouldScroll = searchParams ? searchParams.get('scrollToRank') === 'true' : false;
    if (shouldScroll && leaderboard.length > 0 && !hasAutoScrolledRef.current) {
      hasAutoScrolledRef.current = true;
      setTimeout(() => {
        scrollToMyRank(false);
      }, 250);
    }
  }, [leaderboard, searchParams, scrollToMyRank]);

  // Infinite Scroll IntersectionObserver
  useEffect(() => {
    if (searchQuery.trim()) return;
    if (leaderboardVisibleCount >= leaderboard.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLeaderboardVisibleCount((prev) => Math.min(leaderboard.length, prev + 30));
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [leaderboardVisibleCount, leaderboard.length, searchQuery]);

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

  const formatTime = (seconds: number | null | undefined) => {
    if (!seconds && seconds !== 0) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const inProgressAttempt = useMemo(() => {
    return attempts.find(a => (a.status || '').toLowerCase().trim() === 'in_progress');
  }, [attempts]);

  const completedAttempts = useMemo(() => {
    return attempts.filter(a => {
      const s = (a.status || '').toLowerCase().trim();
      return (
        s === 'submitted' ||
        s === 'auto_submitted' ||
        s === 'completed' ||
        (s !== 'in_progress' && ((a as any).submittedAt !== null || (a as any).netScore !== null))
      );
    });
  }, [attempts]);

  const totalQuizMarks = quiz?.totalMarks || (quiz ? quiz.numQuestionsToServe * 2 : 0);

  const canRetake = useMemo(() => {
    if (!quiz) return false;
    if (inProgressAttempt) return false;
    if (!quiz.allowMultipleAttempts) return completedAttempts.length === 0;
    if (quiz.maxAttempts !== null && quiz.maxAttempts !== undefined && quiz.maxAttempts > 0) {
      return completedAttempts.length < quiz.maxAttempts;
    }
    return true;
  }, [quiz, completedAttempts, inProgressAttempt]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <AlertCircle className={styles.emptyIcon} style={{ color: '#ef4444' }} />
          <h2>Unable to Load Leaderboard</h2>
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
              href={`/dashboard/quizzes/${quizId}/attempts${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
              className={`${styles.actionBtn} ${styles.secondaryBtn}`}
              title="Review all past attempts for this quiz"
            >
              <RotateCcw size={16} />
              <span>Review Attempts ({attempts.length})</span>
            </Link>

            {completedAttempts.length > 0 && (
              <Link
                href={`/dashboard/quizzes/${quizId}/result?attempt=${completedAttempts[0].id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className={`${styles.actionBtn} ${styles.secondaryBtn}`}
                title="View your latest attempt score and review"
              >
                <FileText size={16} />
                <span>Latest Result</span>
              </Link>
            )}

            {inProgressAttempt ? (
              <Link
                href={`/dashboard/quizzes/${quizId}/attempt/${inProgressAttempt.id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
                style={{ background: '#f59e0b' }}
              >
                <Play size={16} /> Continue In-Progress
              </Link>
            ) : canRetake ? (
              <button
                onClick={handleStartQuiz}
                disabled={starting}
                className={`${styles.actionBtn} ${styles.primaryBtn}`}
              >
                <Play size={16} />
                {starting ? 'Starting...' : attempts.length > 0 ? 'Retake Quiz' : 'Start Quiz'}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Leaderboard Card */}
      <div className={styles.leaderboardCard}>
        <div className={styles.leaderboardTopBanner}>
          <div className={styles.policyBadge}>
            <Award size={16} style={{ color: '#f59e0b' }} />
            <span>
              Ranking Policy: <strong>{quiz.positionType === 'first_attempt' ? 'First Attempt Score' : 'Highest Score Across All Attempts'}</strong>
            </span>
          </div>
          <div className={styles.bannerActions}>
            {userRank !== null && (
              <div className={styles.userRankHighlight}>
                <Trophy size={15} />
                <span>Your Rank: #{userRank} of {totalParticipants}</span>
              </div>
            )}
            {currentUserRankIndex >= 0 && (
              <button
                type="button"
                className={styles.showAroundMyRankBtn}
                onClick={() => scrollToMyRank(true)}
                title="Smooth scroll to your rank in the leaderboard"
              >
                <Target size={14} />
                <span>Show around my rank</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Toolbar */}
        {leaderboard.length > 0 && (
          <div className={styles.toolbarRow}>
            <div className={styles.searchBox}>
              <Search className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search student by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={styles.clearSearchBtn}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.searchCountText}>
              {searchQuery.trim() ? (
                <span>Showing {filteredLeaderboard.length} of {leaderboard.length} participants</span>
              ) : (
                <span>{leaderboard.length} total participant{leaderboard.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className={styles.emptyState}>
            <Trophy className={styles.emptyIcon} />
            <h3>No Leaderboard Entries Yet</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              Be the first student to complete this quiz and claim the top rank!
            </p>
          </div>
        ) : displayedLeaderboard.length === 0 ? (
          <div className={styles.emptyState}>
            <Search className={styles.emptyIcon} />
            <h3>No matching participants</h3>
            <p style={{ color: 'var(--text-secondary)' }}>
              No student found matching &quot;{searchQuery}&quot;.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.leaderboardTable}>
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>Rank</th>
                  <th>Student</th>
                  <th>Net Score</th>
                  <th>Attempt</th>
                  <th>Time Taken</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {displayedLeaderboard.map((entry) => {
                  const isRank1 = entry.rank === 1;
                  const isRank2 = entry.rank === 2;
                  const isRank3 = entry.rank === 3;
                  const rankClass = isRank1 ? styles.rank1 : isRank2 ? styles.rank2 : isRank3 ? styles.rank3 : '';
                  const isHighlighted = highlightedStudentId === entry.studentId;

                  return (
                    <tr 
                      key={entry.studentId}
                      id={`leaderboard-row-${entry.studentId}`}
                      className={`${styles.leaderboardRow} ${entry.isCurrentUser ? styles.currentUserRow : ''} ${isHighlighted ? styles.highlightedRow : ''}`}
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
                          <span>{Number(entry.score).toFixed(1)}{totalQuizMarks > 0 ? ` / ${totalQuizMarks.toFixed(1)}` : ''}</span>
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
            {!searchQuery.trim() && leaderboard.length > 0 && (
              <div ref={sentinelRef} className={styles.infiniteScrollSentinel}>
                {leaderboardVisibleCount < leaderboard.length ? (
                  <span>Loading more participants ({leaderboardVisibleCount} of {leaderboard.length})...</span>
                ) : (
                  <span>All {leaderboard.length} participants displayed</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function QuizLeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Loading leaderboard...</p>
          </div>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
