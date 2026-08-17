'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  BarChart2,
  Trophy,
  User,
  Users,
  Clock,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Filter,
  FileText,
  Search,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import styles from './page.module.css';

interface SubmissionEntry {
  attemptId: string;
  studentId: string;
  studentName: string;
  netScore: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  attemptNumber: number;
  isAutoSubmitted: boolean;
}

interface SubmissionEntry {
  attemptId: string;
  studentId: string;
  studentName: string;
  netScore: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  attemptNumber: number;
  isAutoSubmitted: boolean;
}

interface LeaderboardEntry {
  rank: number;
  attemptId: string;
  studentId: string;
  studentName: string;
  netScore: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  attemptNumber: number;
  isAutoSubmitted: boolean;
  isCurrentUser: boolean;
}

interface QuestionAnalytics {
  questionId: string;
  questionType: string;
  questionText: string;
  totalAttempts: number;
  correctCount: number;
  correctPercentage: number;
  optionDistribution: Record<string, any>;
  mostCommonWrongOption: string | null;
  options: any[];
  correctOption: string;
}

interface QuizData {
  id: string;
  title: string;
  totalQuestions: number;
  durationMinutes: number;
}

interface AttemptData {
  id: string;
  netScore: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  negativeMarks: number;
  timeTakenSeconds: number;
  submittedAt: string;
  attemptNumber: number;
  isAutoSubmitted: boolean;
  questionsReview?: any[];
}

interface ResultsData {
  quiz: QuizData;
  summary: {
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    averageTimeSeconds: number;
  };
  leaderboard: LeaderboardEntry[];
  allSubmissions?: SubmissionEntry[];
  perQuestionAnalytics: QuestionAnalytics[];
  attempt: AttemptData | null;
}

export default function TeacherQuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const attemptId = searchParams.get('attempt') || '';
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'leaderboard' | 'questions' | 'attempt'>('overview');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'time' | 'attempt'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Student Submissions tab state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedAttemptData, setSelectedAttemptData] = useState<AttemptData | null>(null);
  const [loadingAttemptData, setLoadingAttemptData] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [modalView, setModalView] = useState<'list' | 'detail'>('list');
  const [modalPage, setModalPage] = useState<number>(1);
  const MODAL_ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchResults();
  }, [quizId, attemptId]);

  const fetchResults = async () => {
    try {
      const params = new URLSearchParams();
      if (attemptId) params.set('attempt', attemptId);

      const res = await fetch(`/api/quiz/${quizId}/results?${params.toString()}`);
      const result = await res.json();

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          router.push('/teacher/dashboard/quizzes');
          return;
        }
        throw new Error(result.error || 'Failed to load results');
      }

      setData(result);

      // Auto select initial student/attempt if attemptId is present
      if (result.attempt) {
        setSelectedAttemptData(result.attempt);
        setSelectedAttemptId(result.attempt.id);
        const matchSub = result.allSubmissions?.find((s: SubmissionEntry) => s.attemptId === result.attempt.id);
        if (matchSub) {
          setSelectedStudentId(matchSub.studentId);
          setShowStudentModal(true);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentAttemptDetails = async (attId: string) => {
    setLoadingAttemptData(true);
    try {
      const res = await fetch(`/api/quiz/${quizId}/results?attempt=${attId}`);
      const result = await res.json();
      if (res.ok && result.attempt) {
        setSelectedAttemptData(result.attempt);
      }
    } catch (err) {
      console.error('Failed to load student attempt details', err);
    } finally {
      setLoadingAttemptData(false);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-error';
  };

  const handleSort = (field: 'rank' | 'score' | 'time' | 'attempt') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Group submissions by student for Submissions Tab
  const submissionsList = data?.allSubmissions || data?.leaderboard || [];
  const uniqueStudentsMap = new Map<string, { studentId: string; studentName: string; bestScore: number; attempts: SubmissionEntry[] }>();
  submissionsList.forEach((sub: any) => {
    if (!uniqueStudentsMap.has(sub.studentId)) {
      uniqueStudentsMap.set(sub.studentId, {
        studentId: sub.studentId,
        studentName: sub.studentName || 'Unknown',
        bestScore: sub.percentageScore ?? sub.netScore ?? 0,
        attempts: [],
      });
    }
    const studentObj = uniqueStudentsMap.get(sub.studentId)!;
    if ((sub.percentageScore ?? sub.netScore ?? 0) > studentObj.bestScore) {
      studentObj.bestScore = sub.percentageScore ?? sub.netScore ?? 0;
    }
    studentObj.attempts.push(sub);
  });

  const uniqueStudents = Array.from(uniqueStudentsMap.values()).map(st => ({
    ...st,
    attempts: st.attempts.sort((a, b) => b.attemptNumber - a.attemptNumber),
  }));

  const filteredStudents = uniqueStudents.filter(st => {
    return st.studentName.toLowerCase().includes(studentSearch.toLowerCase());
  });

  const handleOpenStudentModal = (studentId: string) => {
    setSelectedStudentId(studentId);
    setShowStudentModal(true);
    setModalView('list');
    setModalPage(1);
    const student = uniqueStudents.find(s => s.studentId === studentId);
    if (student && student.attempts.length > 0) {
      const latestAttemptId = student.attempts[0].attemptId;
      setSelectedAttemptId(latestAttemptId);
    }
  };

  const handleSelectAttempt = (attId: string) => {
    setSelectedAttemptId(attId);
    setModalView('detail');
    loadStudentAttemptDetails(attId);
  };

  const selectedStudent = uniqueStudents.find(s => s.studentId === selectedStudentId);

  const filteredLeaderboard = data?.leaderboard
    ?.filter(entry =>
      entry.studentName.toLowerCase().includes(search.toLowerCase())
    )
    ?.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'score': aVal = a.netScore; bVal = b.netScore; break;
        case 'time': aVal = a.timeTakenSeconds || 0; bVal = b.timeTakenSeconds || 0; break;
        case 'attempt': aVal = a.attemptNumber; bVal = b.attemptNumber; break;
        default: aVal = a.rank; bVal = b.rank;
      }
      const order = sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle className={styles.errorIcon} />
          <h2>Unable to Load Results</h2>
          <p>{error || 'Results not found or access denied'}</p>
          <Link href="/teacher/dashboard/quizzes" className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  const { quiz, summary, leaderboard, perQuestionAnalytics, attempt } = data;
  const isViewingAttempt = !!attemptId;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/teacher/dashboard/quizzes" className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          Back to Quizzes
        </Link>

        <div className={styles.quizHeader}>
          <h1 className={styles.quizTitle}>{quiz.title}</h1>
          <div className={styles.quizMeta}>
            <span className={styles.metaItem}>
              <Target className={styles.metaIcon} /> {quiz.totalQuestions} Questions
            </span>
            <span className={styles.metaItem}>
              <Clock className={styles.metaIcon} /> {quiz.durationMinutes} min
            </span>
            <span className={styles.metaItem}>
              <User className={styles.metaIcon} /> {summary.totalAttempts} Attempts
            </span>
          </div>

          {isViewingAttempt && attempt && (
            <div className={styles.attemptBadge}>
              <AlertCircle className={styles.badgeIcon} />
              Viewing Attempt #{attempt.attemptNumber} • {attempt.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'} • {formatTime(attempt.timeTakenSeconds)}
            </div>
          )}
        </div>
      </header>

      {error && <div className={styles.errorBanner}><AlertCircle className={styles.errorIcon} />{error}<button onClick={() => setError(null)} className={styles.errorDismiss}>&times;</button></div>}

      <main className={styles.main}>
        {!isViewingAttempt && (
          <>
            {/* Summary Cards */}
            <section className={styles.summarySection}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <TrendingUp className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardValue}>{summary.totalAttempts}</div>
                    <div className={styles.cardLabel}>Total Attempts</div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <BarChart2 className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={`${styles.cardValue} ${getScoreColor(summary.averageScore)}`}>{summary.averageScore.toFixed(1)}%</div>
                    <div className={styles.cardLabel}>Average Score</div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <Trophy className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={`${styles.cardValue} ${getScoreColor(summary.highestScore)}`}>{summary.highestScore.toFixed(1)}%</div>
                    <div className={styles.cardLabel}>Highest Score</div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <Clock className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardValue}>{formatTime(summary.averageTimeSeconds)}</div>
                    <div className={styles.cardLabel}>Avg. Completion Time</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tab Navigation */}
            <nav className={styles.tabNav} role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabActive : ''}`}
              >
                <BarChart2 className={styles.tabIcon} />
                Overview
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'submissions'}
                onClick={() => setActiveTab('submissions')}
                className={`${styles.tabBtn} ${activeTab === 'submissions' ? styles.tabActive : ''}`}
              >
                <Users className={styles.tabIcon} />
                Student Submissions ({uniqueStudents.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'leaderboard'}
                onClick={() => setActiveTab('leaderboard')}
                className={`${styles.tabBtn} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
              >
                <Trophy className={styles.tabIcon} />
                Leaderboard ({leaderboard.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'questions'}
                onClick={() => setActiveTab('questions')}
                className={`${styles.tabBtn} ${activeTab === 'questions' ? styles.tabActive : ''}`}
              >
                <HelpCircle className={styles.tabIcon} />
                Question Analytics ({perQuestionAnalytics.length})
              </button>
            </nav>

            {/* Tab Panels */}
            <div className={styles.tabContent}>
              {/* Submissions Tab */}
              {activeTab === 'submissions' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.submissionsContainer}>
                    <div className={styles.submissionsTableToolbar}>
                      <div className={styles.tableFiltersGroup}>
                        <div className={styles.searchBox} style={{ maxWidth: '300px' }}>
                          <Search className={styles.searchIcon} />
                          <input
                            type="search"
                            placeholder="Search student by name..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            className={styles.searchInput}
                          />
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Showing {filteredStudents.length} Students
                      </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                      <div className={styles.emptyState} style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <Users className={styles.noStudentIcon} style={{ margin: '0 auto 16px' }} />
                        <h3>No Student Submissions Found</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Try adjusting your search or batch filter.</p>
                      </div>
                    ) : (
                      <div className={styles.tableContainer}>
                        <table className={styles.leaderboardTable} role="table">
                          <thead>
                            <tr>
                              <th scope="col">Student Name</th>
                              <th scope="col">Latest Submission</th>
                              <th scope="col">Best Score</th>
                              <th scope="col">Attempts Taken</th>
                              <th scope="col">Status</th>
                              <th scope="col"><span className={styles.visuallyHidden}>Actions</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStudents.map((st) => {
                              const latestAttempt = st.attempts[0];
                              return (
                                <tr key={st.studentId}>
                                  <td className={styles.nameCell} style={{ fontWeight: 700 }}>
                                    {st.studentName}
                                  </td>
                                  <td className={styles.dateCell} style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {latestAttempt?.submittedAt ? new Date(latestAttempt.submittedAt).toLocaleDateString() + ' ' + new Date(latestAttempt.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                  </td>
                                  <td className={styles.scoreCell}>
                                    <span className={`${styles.scoreValue} ${getScoreColor(st.bestScore)}`}>
                                      {st.bestScore.toFixed(1)}%
                                    </span>
                                  </td>
                                  <td>
                                    <span className={styles.attemptBadgeCount}>
                                      <FileText size={12} /> {st.attempts.length} {st.attempts.length === 1 ? 'Attempt' : 'Attempts'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`${styles.statusBadge} ${latestAttempt?.isAutoSubmitted ? styles.autoSubmitted : styles.submitted}`}>
                                      {latestAttempt?.isAutoSubmitted ? 'Auto-submitted' : 'Completed'}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenStudentModal(st.studentId)}
                                      className={styles.viewBtn}
                                    >
                                      View Submissions ({st.attempts.length})
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.overviewGrid}>
                    <div className={styles.overviewCard}>
                      <h3 className={styles.overviewTitle}>
                        <Trophy className={styles.overviewIcon} />
                        Score Distribution
                      </h3>
                      <div className={styles.scoreBars}>
                        {[
                          { label: '90-100%', count: leaderboard.filter(e => e.percentageScore >= 90).length },
                          { label: '80-89%', count: leaderboard.filter(e => e.percentageScore >= 80 && e.percentageScore < 90).length },
                          { label: '70-79%', count: leaderboard.filter(e => e.percentageScore >= 70 && e.percentageScore < 80).length },
                          { label: '60-69%', count: leaderboard.filter(e => e.percentageScore >= 60 && e.percentageScore < 70).length },
                          { label: 'Below 60%', count: leaderboard.filter(e => e.percentageScore < 60).length },
                        ].map((item, i) => (
                          <div key={i} className={styles.scoreBar}>
                            <span className={styles.scoreLabel}>{item.label}</span>
                            <div className={styles.barContainer}>
                              <div
                                className={styles.barFill}
                                style={{ width: `${summary.totalAttempts > 0 ? (item.count / summary.totalAttempts) * 100 : 0}%` }}
                              ></div>
                            </div>
                            <span className={styles.scoreCount}>{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.overviewCard}>
                      <h3 className={styles.overviewTitle}>
                        <Clock className={styles.overviewIcon} />
                        Time Analysis
                      </h3>
                      <div className={styles.timeStats}>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Fastest</span>
                          <span className={styles.timeValue}>
                            {leaderboard.length > 0 && leaderboard[0].timeTakenSeconds
                              ? formatTime(leaderboard[0].timeTakenSeconds!)
                              : 'N/A'}
                          </span>
                        </div>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Average</span>
                          <span className={styles.timeValue}>{formatTime(summary.averageTimeSeconds)}</span>
                        </div>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Slowest</span>
                          <span className={styles.timeValue}>
                            {leaderboard.length > 0 && leaderboard[leaderboard.length - 1].timeTakenSeconds
                              ? formatTime(leaderboard[leaderboard.length - 1].timeTakenSeconds!)
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.leaderboardHeader}>
                    <div className={styles.searchBox}>
                      <Search className={styles.searchIcon} />
                      <input
                        type="search"
                        placeholder="Search by student name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                  </div>

                  <div className={styles.tableContainer}>
                    <table className={styles.leaderboardTable} role="table">
                      <thead>
                        <tr>
                          <th scope="col" onClick={() => handleSort('rank')} className={styles.sortable}>
                            Rank <TrendingUp className={`${styles.sortIcon} ${sortBy === 'rank' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Student</th>
                          <th scope="col" onClick={() => handleSort('score')} className={styles.sortable}>
                            Score <TrendingUp className={`${styles.sortIcon} ${sortBy === 'score' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Correct / Wrong / Skipped</th>
                          <th scope="col" onClick={() => handleSort('time')} className={styles.sortable}>
                            Time <TrendingUp className={`${styles.sortIcon} ${sortBy === 'time' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col" onClick={() => handleSort('attempt')} className={styles.sortable}>
                            Attempt <TrendingUp className={`${styles.sortIcon} ${sortBy === 'attempt' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Status</th>
                          <th scope="col"><span className={styles.visuallyHidden}>Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaderboard?.map((entry, index) => (
                          <tr key={entry.attemptId} className={entry.isCurrentUser ? styles.currentUser : ''}>
                            <td className={styles.rankCell}>
                              {entry.rank <= 3 ? (
                                <span className={`${styles.medal} ${styles[`medal${entry.rank}`]}`}>
                                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                                </span>
                              ) : (
                                <span className={styles.rankNumber}>#{entry.rank}</span>
                              )}
                            </td>
                            <td className={styles.nameCell}>
                              <span className={entry.isCurrentUser ? styles.currentUserName : ''}>
                                {entry.studentName}{entry.isCurrentUser ? ' (You)' : ''}
                              </span>
                            </td>
                            <td className={styles.scoreCell}>
                              <span className={`${styles.scoreValue} ${getScoreColor(entry.netScore)}`}>
                                {entry.netScore.toFixed(1)}%
                              </span>
                            </td>
                            <td className={styles.detailCell}>
                              <span className={`${styles.detailItem} text-success`}>{entry.correctCount}</span>
                              <span className={`${styles.detailItem} text-error`}>{entry.wrongCount}</span>
                              <span className={`${styles.detailItem} text-warning`}>{entry.skippedCount}</span>
                            </td>
                            <td className={styles.timeCell}>{formatTime(entry.timeTakenSeconds)}</td>
                            <td className={styles.attemptCell}>#{entry.attemptNumber}</td>
                            <td className={styles.statusCell}>
                              <span className={`${styles.statusBadge} ${entry.isAutoSubmitted ? styles.autoSubmitted : styles.submitted}`}>
                                {entry.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'}
                              </span>
                            </td>
                            <td>
                              <Link
                                href={`/teacher/dashboard/quizzes/${quizId}/results?attempt=${entry.attemptId}`}
                                className={styles.viewBtn}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {leaderboard.length > 20 && (
                    <p className={styles.leaderboardNote}>
                      Showing all {leaderboard.length} participants
                    </p>
                  )}
                </div>
              )}

              {/* Question Analytics Tab */}
              {activeTab === 'questions' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.questionsAnalytics}>
                    {perQuestionAnalytics.map((q, index) => (
                      <div key={q.questionId} className={styles.analyticsCard}>
                        <div className={styles.analyticsHeader}>
                          <span className={styles.analyticsNumber}>Q{index + 1}</span>
                          <h4 className={styles.analyticsQuestion}>{q.questionText}</h4>
                          <div className={styles.analyticsStats}>
                            <span className={`${styles.analyticsStat} ${q.correctPercentage >= 70 ? 'text-success' : q.correctPercentage >= 50 ? 'text-warning' : 'text-error'}`}>
                              {q.correctPercentage.toFixed(1)}% correct
                            </span>
                            <span className={styles.analyticsStat}>{q.totalAttempts} attempts</span>
                          </div>
                        </div>

                        <div className={styles.optionDistribution}>
                          {q.questionType === 'mcq' ? (
                            Object.entries(q.optionDistribution).map(([stem, counts]: [string, any], optIdx: number) => {
                              const totalStemResponses = counts.T + counts.F + counts.S;
                              const tPercentage = totalStemResponses > 0 ? (counts.T / totalStemResponses) * 100 : 0;
                              const fPercentage = totalStemResponses > 0 ? (counts.F / totalStemResponses) * 100 : 0;
                              const sPercentage = totalStemResponses > 0 ? (counts.S / totalStemResponses) * 100 : 0;

                              const optionData = q.options?.find((o: any) => o.letter === stem);
                              const optionText = optionData?.text || `Stem ${stem}`;
                              const correctAns = q.correctOption?.[optIdx] === 'T' ? 'True' : 'False';

                              return (
                                <div key={stem} className={styles.tfStemBar}>
                                  <div className={styles.tfStemHeader}>
                                    <span className={styles.tfStemLabel}>
                                      {stem}. {optionText}
                                      <span style={{ color: 'var(--success-color)', marginLeft: '6px', fontWeight: 600 }}>
                                        - Correct: {correctAns}
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.tfBarContainer}>
                                    <div className={styles.tfBarFillT} style={{ width: `${tPercentage}%` }} title={`True: ${counts.T}`}>
                                      {tPercentage > 15 && `${tPercentage.toFixed(0)}%`}
                                    </div>
                                    <div className={styles.tfBarFillF} style={{ width: `${fPercentage}%` }} title={`False: ${counts.F}`}>
                                      {fPercentage > 15 && `${fPercentage.toFixed(0)}%`}
                                    </div>
                                    <div className={styles.tfBarFillS} style={{ width: `${sPercentage}%` }} title={`Skipped: ${counts.S}`}>
                                      {sPercentage > 15 && `${sPercentage.toFixed(0)}%`}
                                    </div>
                                  </div>
                                  <div className={styles.tfLegend}>
                                    <span className={styles.legendItem}><span className={styles.legendDotT}></span> {counts.T} True</span>
                                    <span className={styles.legendItem}><span className={styles.legendDotF}></span> {counts.F} False</span>
                                    {counts.S > 0 && <span className={styles.legendItem}><span className={styles.legendDotS}></span> {counts.S} Skipped</span>}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            q.options?.map((optionData: any) => {
                              const option = optionData.letter;
                              const count = q.optionDistribution?.[option] || 0;
                              const percentage = q.totalAttempts > 0 ? (count / q.totalAttempts) * 100 : 0;
                              const isCorrect = q.correctOption === option;

                              return (
                                <div key={option} className={styles.tfStemBar}>
                                  <div className={styles.tfStemHeader}>
                                    <span className={styles.tfStemLabel}>
                                      {option}: {optionData.text}
                                      {isCorrect && (
                                        <span style={{ color: 'var(--success-color)', marginLeft: '6px', fontWeight: 600 }}>
                                          - Correct Option
                                        </span>
                                      )}
                                    </span>
                                    <span className={styles.tfLegend} style={{ marginTop: 0 }}>
                                      <span className={styles.legendItem} style={{ fontSize: '14px', color: 'var(--text-color)' }}>
                                        Selected by {count} ({percentage.toFixed(1)}%)
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.tfBarContainer}>
                                    <div
                                      className={isCorrect ? styles.tfBarFillT : styles.tfBarFillF}
                                      style={{ width: `${percentage}%` }}
                                      title={`Selected by: ${count}`}
                                    >
                                      {percentage > 5 && `${percentage.toFixed(0)}%`}
                                    </div>
                                    <div className={styles.tfBarFillS} style={{ width: `${100 - percentage}%` }} title={`Not Selected: ${q.totalAttempts - count}`}>
                                      {(100 - percentage) > 15 && `${(100 - percentage).toFixed(0)}%`}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {q.mostCommonWrongOption && (
                          <div className={styles.wrongNote}>
                            <XCircle className={styles.wrongIcon} />
                            Most common wrong answer: Option {q.mostCommonWrongOption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Single Attempt View */}
        {isViewingAttempt && attempt && (
          <div className={styles.attemptView}>
            <div className={styles.attemptHeader}>
              <div>
                <h2 className={styles.attemptTitle}>Attempt Details</h2>
                <p className={styles.attemptSubtitle}>
                  Attempt #{attempt.attemptNumber} • {attempt.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'} • {formatTime(attempt.timeTakenSeconds)}
                </p>
              </div>
              <Link href={`/teacher/dashboard/quizzes/${quizId}/results`} className={styles.backToResults}>
                <ChevronLeft className={styles.btnIcon} />
                Back to Leaderboard
              </Link>
            </div>

            <div className={styles.attemptSummary}>
              <div className={styles.attemptScoreCard}>
                <div className={`${styles.attemptScoreValue} ${getScoreColor(attempt.percentageScore)}`}>
                  {attempt.percentageScore.toFixed(1)}%
                </div>
                <div className={styles.attemptScoreLabel}>Final Score</div>
              </div>
              <div className={styles.attemptStats}>
                <div className={`${styles.attemptStat} text-success`}>
                  <div className={styles.attemptStatValue}>{attempt.correctCount}</div>
                  <div className={styles.attemptStatLabel}>Correct</div>
                </div>
                <div className={`${styles.attemptStat} text-error`}>
                  <div className={styles.attemptStatValue}>{attempt.wrongCount}</div>
                  <div className={styles.attemptStatLabel}>Wrong</div>
                </div>
                <div className={`${styles.attemptStat} text-warning`}>
                  <div className={styles.attemptStatValue}>{attempt.skippedCount}</div>
                  <div className={styles.attemptStatLabel}>Skipped</div>
                </div>
                {attempt.negativeMarks > 0 && (
                  <div className={`${styles.attemptStat} text-error`}>
                    <div className={styles.attemptStatValue}>-{attempt.negativeMarks.toFixed(2)}</div>
                    <div className={styles.attemptStatLabel}>Penalty</div>
                  </div>
                )}
              </div>
            </div>

            {/* Answer Review Section */}
            <div id="answer-review-section" className={styles.reviewSectionWrapper} style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '32px', background: 'var(--bg-primary)' }}>
              <div id="review-header-section" className={styles.reviewHeader}>
                <h2 className={styles.reviewTitle}>Answer Review</h2>
                <div className={styles.reviewStats}>
                  <span className={`${styles.reviewStat} text-success`}>
                    <CheckCircle className={styles.reviewIcon} /> {attempt.questionsReview?.filter((q: any) => q.isCorrect).length || 0} Correct
                  </span>
                  {attempt.questionsReview?.some((q: any) => q.isPartial) && (
                    <span className={`${styles.reviewStat} text-info`} style={{ color: 'var(--info-color)', background: 'var(--info-light)' }}>
                      <CheckCircle className={styles.reviewIcon} /> {attempt.questionsReview?.filter((q: any) => q.isPartial).length || 0} Partial
                    </span>
                  )}
                  <span className={`${styles.reviewStat} text-error`}>
                    <XCircle className={styles.reviewIcon} /> {attempt.questionsReview?.filter((q: any) => !q.isCorrect && !q.isPartial && !q.isSkipped).length || 0} Wrong
                  </span>
                  <span className={`${styles.reviewStat} text-warning`}>
                    <HelpCircle className={styles.reviewIcon} /> {attempt.questionsReview?.filter((q: any) => q.isSkipped).length || 0} Skipped
                  </span>
                </div>
              </div>

              <div className={styles.reviewList}>
                {attempt.questionsReview?.map((question: any, index: number) => (
                  <article key={question.questionId} className={`${styles.reviewCard} pdf-question-card ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewQuestionInfo}>
                        <span className={styles.reviewNumber}>Q{index + 1}</span>
                        <span className={`${styles.reviewStatus} ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                          {question.isSkipped ? 'Skipped' : question.isPartial ? 'Partial' : question.isCorrect ? 'Correct' : 'Incorrect'}
                        </span>
                      </div>
                    </div>

                    <h3 className={styles.reviewQuestionText}>{question.questionText}</h3>

                    <div className={styles.reviewOptions}>
                      {question.questionType === 'mcq' ? (
                        question.options?.map((option: any) => {
                          const studentStr = question.studentAnswer || '-'.repeat(question.options.length);
                          const correctStr = question.correctOption || 'F'.repeat(question.options.length);
                          const originalIdx = option.letter.charCodeAt(0) - 65;
                          const isT = studentStr[originalIdx] === 'T';
                          const isF = studentStr[originalIdx] === 'F';
                          const isCorrectT = correctStr[originalIdx] === 'T';
                          const isCorrectF = correctStr[originalIdx] === 'F';
                          const answered = isT || isF;
                          const isCorrect = (isT && isCorrectT) || (isF && isCorrectF);

                          let optionClass = styles.reviewOption;
                          if (answered) {
                            if (isCorrect) optionClass += ` ${styles.optionStudentCorrect}`;
                            else optionClass += ` ${styles.optionIncorrect}`;
                          }

                          return (
                            <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                <span className={styles.optionLetter}>{option.letter}</span>
                                <span className={styles.optionText}>{option.text}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {/* True Pill */}
                                <div style={{ 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                  minWidth: '68px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                  background: isT ? (isCorrectT ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)') : (isCorrectT ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)'), 
                                  border: isT ? (isCorrectT ? '1px solid #10b981' : '1px solid #ef4444') : (isCorrectT ? '1px dashed rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)'), 
                                  color: isT ? (isCorrectT ? '#10b981' : '#ef4444') : (isCorrectT ? '#10b981' : 'var(--text-muted, #71717a)') 
                                }}>
                                  {isT ? (isCorrectT ? '✓ True' : '✗ True') : (isCorrectT ? '✓ True' : 'True')}
                                </div>
                                {/* False Pill */}
                                <div style={{ 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                  minWidth: '68px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                  background: isF ? (isCorrectF ? 'rgba(16, 185, 129, 0.16)' : 'rgba(239, 68, 68, 0.16)') : (isCorrectF ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)'), 
                                  border: isF ? (isCorrectF ? '1px solid #10b981' : '1px solid #ef4444') : (isCorrectF ? '1px dashed rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)'), 
                                  color: isF ? (isCorrectF ? '#10b981' : '#ef4444') : (isCorrectF ? '#10b981' : 'var(--text-muted, #71717a)') 
                                }}>
                                  {isF ? (isCorrectF ? '✓ False' : '✗ False') : (isCorrectF ? '✓ False' : 'False')}
                                </div>
                                <div style={{ minWidth: '80px', textAlign: 'right' }}>
                                  {answered && isCorrect && <span className={styles.correctBadge}>✓ Correct</span>}
                                  {answered && !isCorrect && <span className={styles.wrongBadge}>✗ Wrong</span>}
                                  {!answered && <span className={styles.skippedBadge}>— Skipped</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        question.options?.map((option: any) => {
                          const isStudentAnswer = option.letter === question.studentAnswer;
                          const isCorrectAnswer = option.letter === question.correctOption;
                          const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;

                          let optionClass = styles.reviewOption;
                          if (isStudentAnswer && isCorrectAnswer) optionClass += ` ${styles.optionStudentCorrect}`;
                          else if (isWrongAnswer) optionClass += ` ${styles.optionIncorrect}`;
                          else if (isCorrectAnswer) optionClass += ` ${styles.optionCorrect}`;

                          return (
                            <div key={`${question.questionId}-${option.letter}`} className={optionClass}>
                              <span className={styles.optionLetter}>{option.letter}</span>
                              <span className={styles.optionText}>{option.text}</span>
                              {isStudentAnswer && isCorrectAnswer && <span className={styles.correctBadge}>✓ Student Answer (Correct)</span>}
                              {isWrongAnswer && <span className={styles.wrongBadge}>✗ Student Answer</span>}
                              {!isStudentAnswer && isCorrectAnswer && <span className={styles.keyBadge}>✓ Correct Answer</span>}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {question.explanation && question.explanation.trim() !== '' && (
                      <div className={styles.explanation}>
                        <HelpCircle className={styles.explanationIcon} />
                        <div>
                          <strong>Explanation:</strong>
                          <p>{question.explanation}</p>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Student Submissions Attempts & Answersheet Modal */}
      {showStudentModal && selectedStudent && (
        <div className={styles.modalOverlay} onClick={() => setShowStudentModal(false)}>
          <div className={styles.submissionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderTitle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 className={styles.modalStudentName}>{selectedStudent.studentName}</h3>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                  Total {selectedStudent.attempts.length} {selectedStudent.attempts.length === 1 ? 'attempt taken' : 'attempts taken'} • Best Score: {selectedStudent.bestScore.toFixed(1)}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStudentModal(false)}
                className={styles.modalCloseBtn}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Level 2: Student Attempts Summary Table */}
              {modalView === 'list' && (
                <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={16} /> Submissions & Attempts Breakdown ({selectedStudent.attempts.length}):
                </h4>
                <div className={styles.modalAttemptsTableWrapper}>
                  <table className={styles.modalAttemptsTable}>
                    <thead>
                      <tr>
                        <th>Attempt #</th>
                        <th>Submission Date</th>
                        <th>Score</th>
                        <th>Correct</th>
                        <th>Incorrect</th>
                        <th>Skipped</th>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStudent.attempts
                        .slice((modalPage - 1) * MODAL_ITEMS_PER_PAGE, modalPage * MODAL_ITEMS_PER_PAGE)
                        .map((att) => {
                        const isActive = att.attemptId === selectedAttemptId;
                        return (
                          <tr key={att.attemptId} className={isActive ? styles.activeAttemptRow : ''}>
                            <td style={{ fontWeight: 800 }}>Attempt #{att.attemptNumber}</td>
                            <td style={{ color: 'var(--text-muted)' }}>
                              {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() + ' ' + new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </td>
                            <td className={getScoreColor(att.percentageScore)} style={{ fontWeight: 800 }}>
                              {att.percentageScore.toFixed(1)}%
                            </td>
                            <td className="text-success" style={{ fontWeight: 700 }}>{att.correctCount}</td>
                            <td className="text-error" style={{ fontWeight: 700 }}>{att.wrongCount}</td>
                            <td className="text-warning" style={{ fontWeight: 700 }}>{att.skippedCount}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{formatTime(att.timeTakenSeconds)}</td>
                            <td>
                              <span className={`${styles.statusBadge} ${att.isAutoSubmitted ? styles.autoSubmitted : styles.submitted}`}>
                                {att.isAutoSubmitted ? 'Auto-submitted' : 'Completed'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleSelectAttempt(att.attemptId)}
                                className={styles.selectAttemptBtn}
                              >
                                View Answersheet
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination controls */}
                {selectedStudent.attempts.length > MODAL_ITEMS_PER_PAGE && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
                    <button 
                      disabled={modalPage === 1}
                      onClick={() => setModalPage(p => p - 1)}
                      className={styles.viewBtn} style={{ padding: '6px 12px', opacity: modalPage === 1 ? 0.5 : 1, cursor: modalPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Previous
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>
                      Page {modalPage} of {Math.ceil(selectedStudent.attempts.length / MODAL_ITEMS_PER_PAGE)}
                    </span>
                    <button 
                      disabled={modalPage === Math.ceil(selectedStudent.attempts.length / MODAL_ITEMS_PER_PAGE)}
                      onClick={() => setModalPage(p => p + 1)}
                      className={styles.viewBtn} style={{ padding: '6px 12px', opacity: modalPage === Math.ceil(selectedStudent.attempts.length / MODAL_ITEMS_PER_PAGE) ? 0.5 : 1, cursor: modalPage === Math.ceil(selectedStudent.attempts.length / MODAL_ITEMS_PER_PAGE) ? 'not-allowed' : 'pointer' }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* Level 3: Answersheet Review */}
              {modalView === 'detail' && (
                <div>
                  <button 
                    onClick={() => setModalView('list')}
                    className={styles.viewBtn} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <ChevronLeft size={16} /> Back to Submissions List
                  </button>
                  
                  {loadingAttemptData ? (
                    <div className={styles.loading} style={{ minHeight: '200px' }}>
                      <div className={styles.spinner}></div>
                      <p>Loading submission answer sheet...</p>
                    </div>
                  ) : selectedAttemptData ? (
                <div className={styles.attemptView} style={{ animation: 'none', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
                  <div className={styles.attemptSummary}>
                    <div className={styles.attemptScoreCard}>
                      <div className={`${styles.attemptScoreValue} ${getScoreColor(selectedAttemptData.percentageScore)}`}>
                        {selectedAttemptData.percentageScore.toFixed(1)}%
                      </div>
                      <div className={styles.attemptScoreLabel}>Attempt #{selectedAttemptData.attemptNumber} Score</div>
                    </div>
                    <div className={styles.attemptStats}>
                      <div className={`${styles.attemptStat} text-success`}>
                        <div className={styles.attemptStatValue}>{selectedAttemptData.correctCount}</div>
                        <div className={styles.attemptStatLabel}>Correct</div>
                      </div>
                      <div className={`${styles.attemptStat} text-error`}>
                        <div className={styles.attemptStatValue}>{selectedAttemptData.wrongCount}</div>
                        <div className={styles.attemptStatLabel}>Wrong</div>
                      </div>
                      <div className={`${styles.attemptStat} text-warning`}>
                        <div className={styles.attemptStatValue}>{selectedAttemptData.skippedCount}</div>
                        <div className={styles.attemptStatLabel}>Skipped</div>
                      </div>
                      <div className={styles.attemptStat}>
                        <div className={styles.attemptStatValue} style={{ fontSize: '20px', color: 'var(--text-color)' }}>
                          {formatTime(selectedAttemptData.timeTakenSeconds)}
                        </div>
                        <div className={styles.attemptStatLabel}>Time Taken</div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.reviewSectionWrapper} style={{ marginTop: '24px' }}>
                    <div className={styles.reviewHeader}>
                      <h4 className={styles.reviewTitle}>Complete Submitted Answersheet</h4>
                    </div>

                    <div className={styles.reviewList}>
                      {selectedAttemptData.questionsReview?.map((question: any, index: number) => (
                        <article key={question.questionId} className={`${styles.reviewCard} ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                          <div className={styles.reviewHeader}>
                            <div className={styles.reviewQuestionInfo}>
                              <span className={styles.reviewNumber}>Q{index + 1}</span>
                              <span className={`${styles.reviewStatus} ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                                {question.isSkipped ? 'Skipped' : question.isPartial ? 'Partial' : question.isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                          </div>

                          <h3 className={styles.reviewQuestionText}>{question.questionText}</h3>

                          <div className={styles.reviewOptions}>
                            {question.questionType === 'mcq' ? (
                              question.options?.map((option: any) => {
                                const studentStr = question.studentAnswer || '-'.repeat(question.options.length);
                                const correctStr = question.correctOption || 'F'.repeat(question.options.length);
                                const originalIdx = option.letter.charCodeAt(0) - 65;
                                const isT = studentStr[originalIdx] === 'T';
                                const isF = studentStr[originalIdx] === 'F';
                                const isCorrectT = correctStr[originalIdx] === 'T';
                                const isCorrectF = correctStr[originalIdx] === 'F';
                                const answered = isT || isF;
                                const isCorrect = (isT && isCorrectT) || (isF && isCorrectF);

                                let optionClass = styles.reviewOption;
                                if (answered) {
                                  if (isCorrect) optionClass += ` ${styles.optionStudentCorrect}`;
                                  else optionClass += ` ${styles.optionIncorrect}`;
                                }

                                return (
                                    <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                        <span className={styles.optionLetter}>{option.letter}</span>
                                        <span className={styles.optionText}>{option.text}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                        <div style={{ 
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                          minWidth: '58px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                          background: isCorrectT ? 'var(--success-color, #10b981)' : ((isT && !isCorrectT) ? 'var(--error-color, #ef4444)' : 'var(--bg-tertiary, #27272a)'), 
                                          border: (isT && !isCorrectT) ? '2px solid var(--error-color, #ef4444)' : ((isT && isCorrectT) ? '2px solid var(--success-color, #10b981)' : '1px solid var(--border-color, rgba(255,255,255,0.1))'), 
                                          color: (isCorrectT || (isT && !isCorrectT)) ? 'white' : 'var(--text-muted, #a1a1aa)' 
                                        }}>
                                          True
                                        </div>
                                        <div style={{ 
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                          minWidth: '58px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                          background: isCorrectF ? 'var(--success-color, #10b981)' : ((isF && !isCorrectF) ? 'var(--error-color, #ef4444)' : 'var(--bg-tertiary, #27272a)'), 
                                          border: (isF && !isCorrectF) ? '2px solid var(--error-color, #ef4444)' : ((isF && isCorrectF) ? '2px solid var(--success-color, #10b981)' : '1px solid var(--border-color, rgba(255,255,255,0.1))'), 
                                          color: (isCorrectF || (isF && !isCorrectF)) ? 'white' : 'var(--text-muted, #a1a1aa)' 
                                        }}>
                                          False
                                        </div>
                                        <div style={{ minWidth: '60px', textAlign: 'right' }}>
                                          {answered && isCorrect && <span className={styles.correctBadge}>Correct</span>}
                                          {answered && !isCorrect && <span className={styles.wrongBadge}>Wrong</span>}
                                        </div>
                                      </div>
                                    </div>
                                  );
                              })
                            ) : (
                              question.options?.map((option: any) => {
                                const isStudentAnswer = option.letter === question.studentAnswer;
                                const isCorrectAnswer = option.letter === question.correctOption;

                                let optionClass = styles.reviewOption;
                                if (isCorrectAnswer) optionClass += ` ${styles.optionCorrect}`;
                                if (isStudentAnswer && !isCorrectAnswer) optionClass += ` ${styles.optionIncorrect}`;
                                if (isStudentAnswer && isCorrectAnswer) optionClass += ` ${styles.optionStudentCorrect}`;

                                return (
                                  <div key={`${question.questionId}-${option.letter}`} className={optionClass}>
                                    <span className={styles.optionLetter}>{option.letter}</span>
                                    <span className={styles.optionText}>{option.text}</span>
                                    {isCorrectAnswer && <span className={styles.correctBadge}>Correct</span>}
                                    {isStudentAnswer && !isCorrectAnswer && <span className={styles.wrongBadge}>Student Answer</span>}
                                    {isStudentAnswer && isCorrectAnswer && <span className={styles.correctBadge}>Student Answer</span>}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {question.explanation && question.explanation.trim() !== '' && (
                            <div className={styles.explanation}>
                              <HelpCircle className={styles.explanationIcon} />
                              <div>
                                <strong>Explanation:</strong>
                                <p>{question.explanation}</p>
                              </div>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}