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
        studentName: sub.studentName,
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

  const filteredStudents = uniqueStudents.filter(st =>
    st.studentName.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Auto select first student if none selected
  useEffect(() => {
    if (activeTab === 'submissions' && !selectedStudentId && uniqueStudents.length > 0) {
      const firstStudent = uniqueStudents[0];
      setSelectedStudentId(firstStudent.studentId);
      const firstAttemptId = firstStudent.attempts[0]?.attemptId;
      if (firstAttemptId) {
        setSelectedAttemptId(firstAttemptId);
        loadStudentAttemptDetails(firstAttemptId);
      }
    }
  }, [activeTab, uniqueStudents, selectedStudentId]);

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    const student = uniqueStudents.find(s => s.studentId === studentId);
    if (student && student.attempts.length > 0) {
      const latestAttemptId = student.attempts[0].attemptId;
      setSelectedAttemptId(latestAttemptId);
      loadStudentAttemptDetails(latestAttemptId);
    }
  };

  const handleSelectAttempt = (attId: string) => {
    setSelectedAttemptId(attId);
    loadStudentAttemptDetails(attId);
  };

  const selectedStudent = uniqueStudents.find(s => s.studentId === selectedStudentId);
  const selectedStudentIndex = uniqueStudents.findIndex(s => s.studentId === selectedStudentId);

  const handleCycleStudent = (direction: number) => {
    const nextIdx = selectedStudentIndex + direction;
    if (nextIdx >= 0 && nextIdx < uniqueStudents.length) {
      handleSelectStudent(uniqueStudents[nextIdx].studentId);
    }
  };

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
                    {uniqueStudents.length === 0 ? (
                      <div className={styles.emptyState} style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <Users className={styles.noStudentIcon} style={{ margin: '0 auto 16px' }} />
                        <h3>No Student Submissions Yet</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Students haven't submitted any attempts for this quiz.</p>
                      </div>
                    ) : (
                      <div className={styles.submissionsLayout}>
                        {/* Sidebar Student List */}
                        <div className={styles.submissionsSidebar}>
                          <div className={styles.sidebarHeader}>
                            <h3 className={styles.sidebarTitle}>
                              <Users size={18} />
                              Students ({uniqueStudents.length})
                            </h3>
                          </div>
                          
                          <div className={styles.searchBox} style={{ maxWidth: '100%' }}>
                            <Search className={styles.searchIcon} />
                            <input
                              type="search"
                              placeholder="Search student..."
                              value={studentSearch}
                              onChange={e => setStudentSearch(e.target.value)}
                              className={styles.searchInput}
                              style={{ fontSize: '13px', padding: '10px 14px 10px 40px' }}
                            />
                          </div>

                          <div className={styles.studentListScroll}>
                            {filteredStudents.map((st) => {
                              const isSelected = st.studentId === selectedStudentId;
                              return (
                                <button
                                  key={st.studentId}
                                  type="button"
                                  onClick={() => handleSelectStudent(st.studentId)}
                                  className={`${styles.studentCard} ${isSelected ? styles.studentCardActive : ''}`}
                                >
                                  <div className={styles.studentCardHeader}>
                                    <span className={styles.studentCardName}>{st.studentName}</span>
                                    <span className={`${styles.studentScoreBadge} ${getScoreColor(st.bestScore)}`}>
                                      {st.bestScore.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className={styles.studentCardMeta}>
                                    <span className={styles.attemptBadgeCount}>
                                      <FileText size={12} />
                                      {st.attempts.length} {st.attempts.length === 1 ? 'Attempt' : 'Attempts'}
                                    </span>
                                    <span>Latest: {st.attempts[0].submittedAt ? new Date(st.attempts[0].submittedAt).toLocaleDateString() : 'N/A'}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Main Submission Review Panel */}
                        <div className={styles.submissionsMain}>
                          {selectedStudent ? (
                            <>
                              {/* Header Navigation & Cycle */}
                              <div className={styles.studentNavHeader}>
                                <div className={styles.studentNavTitle}>
                                  <h3 className={styles.studentNavName}>{selectedStudent.studentName}</h3>
                                  <div className={styles.studentNavSub}>
                                    <span>Student {selectedStudentIndex + 1} of {uniqueStudents.length}</span>
                                    <span>•</span>
                                    <span>Total {selectedStudent.attempts.length} {selectedStudent.attempts.length === 1 ? 'attempt' : 'attempts'}</span>
                                  </div>
                                </div>

                                <div className={styles.studentNavButtons}>
                                  <button
                                    type="button"
                                    disabled={selectedStudentIndex <= 0}
                                    onClick={() => handleCycleStudent(-1)}
                                    className={styles.navCycleBtn}
                                  >
                                    <ChevronLeft size={16} /> Previous Student
                                  </button>
                                  <button
                                    type="button"
                                    disabled={selectedStudentIndex >= uniqueStudents.length - 1}
                                    onClick={() => handleCycleStudent(1)}
                                    className={styles.navCycleBtn}
                                  >
                                    Next Student <ChevronRight size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* Multiple Attempts Selector (If > 1 attempt) */}
                              {selectedStudent.attempts.length > 1 && (
                                <div className={styles.attemptPillsBar}>
                                  <span className={styles.attemptPillLabel}>Select Attempt:</span>
                                  {selectedStudent.attempts.map((att) => {
                                    const isActive = att.attemptId === selectedAttemptId;
                                    return (
                                      <button
                                        key={att.attemptId}
                                        type="button"
                                        onClick={() => handleSelectAttempt(att.attemptId)}
                                        className={`${styles.attemptPillBtn} ${isActive ? styles.attemptPillActive : ''}`}
                                      >
                                        Attempt #{att.attemptNumber} ({att.percentageScore.toFixed(0)}%)
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Answer Review Section */}
                              {loadingAttemptData ? (
                                <div className={styles.loading} style={{ minHeight: '300px' }}>
                                  <div className={styles.spinner}></div>
                                  <p>Loading submission answers...</p>
                                </div>
                              ) : selectedAttemptData ? (
                                <div className={styles.attemptView} style={{ animation: 'none' }}>
                                  {/* Attempt Summary Bar */}
                                  <div className={styles.attemptSummary}>
                                    <div className={styles.attemptScoreCard}>
                                      <div className={`${styles.attemptScoreValue} ${getScoreColor(selectedAttemptData.percentageScore)}`}>
                                        {selectedAttemptData.percentageScore.toFixed(1)}%
                                      </div>
                                      <div className={styles.attemptScoreLabel}>Score (Attempt #{selectedAttemptData.attemptNumber})</div>
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

                                  {/* Answer Review List */}
                                  <div className={styles.reviewSectionWrapper} style={{ marginTop: '24px' }}>
                                    <div className={styles.reviewHeader}>
                                      <h4 className={styles.reviewTitle}>Complete Submitted Answers</h4>
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
                                                  <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', fontWeight: 600 }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isCorrectT ? 'var(--success-color)' : (isT ? 'transparent' : 'var(--bg-tertiary)'), border: (isT && !isCorrectT) ? '2px solid var(--error-color)' : '2px solid transparent', color: isCorrectT ? 'white' : (isT ? 'var(--error-color)' : 'var(--text-muted)') }}>
                                                        <Check size={18} />
                                                      </div>
                                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isCorrectF ? 'var(--success-color)' : (isF ? 'transparent' : 'var(--bg-tertiary)'), border: (isF && !isCorrectF) ? '2px solid var(--error-color)' : '2px solid transparent', color: isCorrectF ? 'white' : (isF ? 'var(--error-color)' : 'var(--text-muted)') }}>
                                                        <X size={18} />
                                                      </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                      <span className={styles.optionLetter}>{option.letter}</span>
                                                      <span className={styles.optionText}>{option.text}</span>
                                                    </div>
                                                    <div style={{ width: '60px', textAlign: 'right' }}>
                                                      {answered && isCorrect && <span className={styles.correctBadge}>Correct</span>}
                                                      {answered && !isCorrect && <span className={styles.wrongBadge}>Wrong</span>}
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
                            </>
                          ) : (
                            <div className={styles.noStudentSelected}>
                              <Users className={styles.noStudentIcon} />
                              <p>Select a student from the left panel to inspect their submission.</p>
                            </div>
                          )}
                        </div>
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
                            <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px' }}>
                              <div style={{ display: 'flex', gap: '8px', fontWeight: 600 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isCorrectT ? 'var(--success-color)' : (isT ? 'transparent' : 'var(--bg-tertiary)'), border: (isT && !isCorrectT) ? '2px solid var(--error-color)' : '2px solid transparent', color: isCorrectT ? 'white' : (isT ? 'var(--error-color)' : 'var(--text-muted)') }}>
                                  <Check size={18} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isCorrectF ? 'var(--success-color)' : (isF ? 'transparent' : 'var(--bg-tertiary)'), border: (isF && !isCorrectF) ? '2px solid var(--error-color)' : '2px solid transparent', color: isCorrectF ? 'white' : (isF ? 'var(--error-color)' : 'var(--text-muted)') }}>
                                  <X size={18} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                <span className={styles.optionLetter}>{option.letter}</span>
                                <span className={styles.optionText}>{option.text}</span>
                              </div>
                              <div style={{ width: '60px', textAlign: 'right' }}>
                                {answered && isCorrect && <span className={styles.correctBadge}>Correct</span>}
                                {answered && !isCorrect && <span className={styles.wrongBadge}>Wrong</span>}
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
                              {isStudentAnswer && !isCorrectAnswer && <span className={styles.wrongBadge}>Your Answer</span>}
                              {isStudentAnswer && isCorrectAnswer && <span className={styles.correctBadge}>Your Answer</span>}
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
    </div>
  );
}