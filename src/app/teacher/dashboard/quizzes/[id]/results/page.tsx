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
  Award,
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
  const tabParam = searchParams.get('tab');
  const studentParam = searchParams.get('student');
  const attemptParam = searchParams.get('attempt') || '';

  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'leaderboard' | 'questions' | 'attempt'>(
    (tabParam as any) || (studentParam ? 'submissions' : 'overview')
  );
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'time' | 'attempt'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Student Submissions view state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(studentParam);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(attemptParam || null);
  const [selectedAttemptData, setSelectedAttemptData] = useState<AttemptData | null>(null);
  const [loadingAttemptData, setLoadingAttemptData] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');

  useEffect(() => {
    fetchResults();
  }, [quizId, attemptParam]);

  useEffect(() => {
    if (studentParam !== selectedStudentId) {
      setSelectedStudentId(studentParam);
    }
    if (attemptParam !== selectedAttemptId) {
      setSelectedAttemptId(attemptParam || null);
      if (attemptParam) {
        loadStudentAttemptDetails(attemptParam);
      }
    }
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam as any);
    }
  }, [studentParam, attemptParam, tabParam]);

  const fetchResults = async () => {
    try {
      const p = new URLSearchParams();
      p.set('view', 'teacher');
      if (attemptParam) p.set('attempt', attemptParam);

      const res = await fetch(`/api/quiz/${quizId}/results?${p.toString()}`);
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
        studentName: sub.studentName || 'Unknown',
        bestScore: sub.netScore ?? 0,
        attempts: [],
      });
    }
    const studentObj = uniqueStudentsMap.get(sub.studentId)!;
    if ((sub.netScore ?? 0) > studentObj.bestScore) {
      studentObj.bestScore = sub.netScore ?? 0;
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

  const handleOpenStudentSubmissions = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSelectedAttemptId(null);
    setSelectedAttemptData(null);
    setActiveTab('submissions');
    router.push(`/teacher/dashboard/quizzes/${quizId}/results?tab=submissions&student=${studentId}`, { scroll: false });
  };

  const handleSelectAttempt = (attId: string) => {
    setSelectedAttemptId(attId);
    loadStudentAttemptDetails(attId);
    router.push(`/teacher/dashboard/quizzes/${quizId}/results?tab=submissions&student=${selectedStudentId}&attempt=${attId}`, { scroll: false });
  };

  const handleBackToStudentAttempts = () => {
    setSelectedAttemptId(null);
    setSelectedAttemptData(null);
    if (selectedStudentId) {
      router.push(`/teacher/dashboard/quizzes/${quizId}/results?tab=submissions&student=${selectedStudentId}`, { scroll: false });
    }
  };

  const handleBackToAllStudents = () => {
    setSelectedStudentId(null);
    setSelectedAttemptId(null);
    setSelectedAttemptData(null);
    router.push(`/teacher/dashboard/quizzes/${quizId}/results?tab=submissions`, { scroll: false });
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
  const isViewingAttempt = !!attemptParam && !!attempt;
  const totalMarks = (quiz as any)?.totalMarks !== undefined 
    ? (quiz as any).totalMarks 
    : ((quiz?.totalQuestions || 0) * 2);

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
                    <div className={`${styles.cardValue} ${getScoreColor(summary.averageScore)}`}>{summary.averageScore.toFixed(1)} Marks</div>
                    <div className={styles.cardLabel}>Average Score</div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <Trophy className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={`${styles.cardValue} ${getScoreColor(summary.highestScore)}`}>{summary.highestScore.toFixed(1)} Marks</div>
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
                  {selectedStudent ? (
                    <div className={styles.studentAttemptsContainer}>
                      {selectedAttemptId ? (
                        /* Level 3: Question-by-Question Answersheet Full-Page Review */
                        <div>
                          <div style={{ marginBottom: '20px' }}>
                            <button
                              type="button"
                              onClick={handleBackToStudentAttempts}
                              className={styles.secondaryBtn}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600 }}
                            >
                              <ChevronLeft size={18} /> Back to {selectedStudent.studentName}&apos;s Submissions
                            </button>
                          </div>

                          {loadingAttemptData ? (
                            <div className={styles.loading} style={{ minHeight: '300px' }}>
                              <div className={styles.spinner}></div>
                              <p>Loading submission answer sheet...</p>
                            </div>
                          ) : selectedAttemptData ? (
                            <div className={styles.attemptView} style={{ animation: 'none' }}>
                              <div className={styles.attemptSummary}>
                                <div className={styles.attemptScoreCard}>
                                  <div className={`${styles.attemptScoreValue} ${getScoreColor(selectedAttemptData.netScore)}`}>
                                    {selectedAttemptData.netScore.toFixed(1)} Marks
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
                                        {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                                          question.options?.map((option: any, idx: number) => {
                                            const studentStr = question.studentAnswer || '-'.repeat(question.options.length);
                                            const correctStr = question.correctOption || 'F'.repeat(question.options.length);
                                            const originalIdx = option.letter.charCodeAt(0) - 65;
                                            const isT = studentStr[originalIdx] === 'T';
                                            const isF = studentStr[originalIdx] === 'F';
                                            const isCorrectT = correctStr[originalIdx] === 'T';
                                            const isCorrectF = correctStr[originalIdx] === 'F';
                                            const answered = isT || isF;
                                            const isCorrect = (isT && isCorrectT) || (isF && isCorrectF);
                                            const displayLetter = String.fromCharCode(65 + idx);

                                            let optionClass = styles.reviewOption;
                                            if (answered) {
                                              if (isCorrect) optionClass += ` ${styles.optionStudentCorrect}`;
                                              else optionClass += ` ${styles.optionIncorrect}`;
                                            }

                                            return (
                                              <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                                  <span className={styles.optionLetter}>{displayLetter}</span>
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
                                                  <div style={{ minWidth: '75px', textAlign: 'right' }}>
                                                    {answered && isCorrect && <span className={styles.correctBadge}>✓ Correct</span>}
                                                    {answered && !isCorrect && <span className={styles.wrongBadge}>✗ Wrong</span>}
                                                    {!answered && <span className={styles.skippedBadge}>— Skipped</span>}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })
                                        ) : (
                                          question.options?.map((option: any, optIdx: number) => {
                                            const displayLetter = String.fromCharCode(65 + optIdx);
                                            const isStudentAnswer = option.letter === question.studentAnswer;
                                            const isCorrectAnswer = option.letter === question.correctOption;
                                            const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;

                                            let optionClass = styles.reviewOption;
                                            if (isStudentAnswer && isCorrectAnswer) optionClass += ` ${styles.optionStudentCorrect}`;
                                            else if (isWrongAnswer) optionClass += ` ${styles.optionIncorrect}`;
                                            else if (isCorrectAnswer) optionClass += ` ${styles.optionCorrect}`;

                                            return (
                                              <div key={`${question.questionId}-${option.letter}`} className={optionClass}>
                                                <span className={styles.optionLetter}>{displayLetter}</span>
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
                          ) : (
                            <div className={styles.emptyState}>
                              <AlertCircle size={32} style={{ color: '#ef4444' }} />
                              <p>Unable to load answersheet details.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Level 2: Student Attempts Full-Page History View (Modeled after /dashboard/quizzes/[id]/attempts) */
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <button
                              type="button"
                              onClick={handleBackToAllStudents}
                              className={styles.secondaryBtn}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600 }}
                            >
                              <ChevronLeft size={18} /> Back to All Student Submissions
                            </button>
                          </div>

                          {/* Student Header Info */}
                          <div className={styles.studentHeader}>
                            <div className={styles.studentHeaderInfo}>
                              <div className={styles.studentTitleRow}>
                                <h2 className={styles.studentTitle}>{selectedStudent.studentName}</h2>
                                <span className={styles.categoryBadge} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                  {selectedStudent.attempts.length} {selectedStudent.attempts.length === 1 ? 'Attempt' : 'Attempts'} Taken
                                </span>
                              </div>
                              <p className={styles.studentSubtitle}>
                                Quiz: <strong>{quiz.title}</strong> • Total Marks: <strong>{totalMarks}m</strong>
                              </p>
                            </div>
                          </div>

                          {/* Student 5 Performance Metric Stat Cards */}
                          <div className={styles.studentMetricsGrid}>
                            <div className={styles.studentStatCard}>
                              <div className={styles.studentStatIconWrap} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
                                <Target size={22} />
                              </div>
                              <div className={styles.studentStatContent}>
                                <span className={styles.studentStatLabel}>Total Attempts</span>
                                <span className={styles.studentStatValue}>{selectedStudent.attempts.length}</span>
                                <span className={styles.studentStatSubtext}>Completed submissions</span>
                              </div>
                            </div>

                            <div className={styles.studentStatCard}>
                              <div className={styles.studentStatIconWrap} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                <Trophy size={22} />
                              </div>
                              <div className={styles.studentStatContent}>
                                <span className={styles.studentStatLabel}>Best Score</span>
                                <span className={styles.studentStatValue} style={{ color: '#10b981' }}>
                                  {selectedStudent.bestScore.toFixed(1)} Marks
                                </span>
                                <span className={styles.studentStatSubtext}>
                                  {totalMarks > 0 ? `${Math.round((selectedStudent.bestScore / totalMarks) * 100)}% of total` : 'Peak performance'}
                                </span>
                              </div>
                            </div>

                            <div className={styles.studentStatCard}>
                              <div className={styles.studentStatIconWrap} style={{ background: 'rgba(147, 51, 234, 0.15)', color: '#a855f7' }}>
                                <TrendingUp size={22} />
                              </div>
                              <div className={styles.studentStatContent}>
                                <span className={styles.studentStatLabel}>Average Score</span>
                                <span className={styles.studentStatValue}>
                                  {(selectedStudent.attempts.reduce((s, a) => s + (a.netScore || 0), 0) / (selectedStudent.attempts.length || 1)).toFixed(1)} Marks
                                </span>
                                <span className={styles.studentStatSubtext}>Across all attempts</span>
                              </div>
                            </div>

                            <div className={styles.studentStatCard}>
                              <div className={styles.studentStatIconWrap} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                <Award size={22} />
                              </div>
                              <div className={styles.studentStatContent}>
                                <span className={styles.studentStatLabel}>1st Attempt Score</span>
                                <span className={styles.studentStatValue}>
                                  {(selectedStudent.attempts.find(a => a.attemptNumber === 1)?.netScore ?? selectedStudent.attempts[selectedStudent.attempts.length - 1]?.netScore ?? 0).toFixed(1)} Marks
                                </span>
                                <span className={styles.studentStatSubtext}>Baseline benchmark</span>
                              </div>
                            </div>

                            <div className={styles.studentStatCard}>
                              <div className={styles.studentStatIconWrap} style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
                                <Clock size={22} />
                              </div>
                              <div className={styles.studentStatContent}>
                                <span className={styles.studentStatLabel}>Best Time</span>
                                <span className={styles.studentStatValue}>
                                  {formatTime(Math.min(...selectedStudent.attempts.map(a => a.timeTakenSeconds || 999999).filter(t => t > 0)))}
                                </span>
                                <span className={styles.studentStatSubtext}>Fastest completion</span>
                              </div>
                            </div>
                          </div>

                          {/* Student Submissions History Cards List */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} style={{ color: 'var(--primary-color)' }} />
                                Past Submissions History ({selectedStudent.attempts.length})
                              </h3>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Click <strong>View Full Answersheet</strong> to inspect question-by-question medical review.
                              </span>
                            </div>

                            <div className={styles.studentAttemptsList}>
                              {selectedStudent.attempts.map((att, idx) => {
                                const isBest = att.netScore === selectedStudent.bestScore && selectedStudent.attempts.length > 1;
                                const isLatest = idx === 0;
                                const percentage = totalMarks > 0 ? Math.round((att.netScore / totalMarks) * 100) : 0;

                                return (
                                  <article key={att.attemptId} className={styles.studentAttemptCard}>
                                    <div className={styles.studentAttemptCardTop}>
                                      <div className={styles.studentAttemptMeta}>
                                        <span className={styles.studentAttemptBadge}>Attempt #{att.attemptNumber}</span>
                                        {isBest && (
                                          <span className={styles.studentBestBadge}>
                                            <Trophy size={13} /> Best Score
                                          </span>
                                        )}
                                        {isLatest && !isBest && (
                                          <span className={styles.studentLatestBadge}>Latest Submission</span>
                                        )}
                                        <span className={`${styles.statusBadge} ${att.isAutoSubmitted ? styles.autoSubmitted : styles.submitted}`}>
                                          {att.isAutoSubmitted ? 'Auto-submitted' : 'Completed'}
                                        </span>
                                      </div>

                                      <div className={styles.studentAttemptDate}>
                                        <Clock size={14} />
                                        {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() + ' • ' + new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                      </div>
                                    </div>

                                    <div className={styles.studentAttemptScoreRow}>
                                      <div className={styles.studentAttemptScorePrimary}>
                                        <span className={`${styles.studentAttemptScoreVal} ${getScoreColor(att.netScore)}`}>
                                          {att.netScore.toFixed(1)} Marks
                                        </span>
                                        <span className={styles.studentAttemptScorePct}>
                                          ({percentage}%)
                                        </span>
                                      </div>

                                      <div className={styles.studentAttemptMetrics}>
                                        <div className={styles.studentAttemptMetric} style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)', background: 'rgba(16, 185, 129, 0.08)' }}>
                                          <CheckCircle size={14} /> {att.correctCount} Correct
                                        </div>
                                        <div className={styles.studentAttemptMetric} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.08)' }}>
                                          <XCircle size={14} /> {att.wrongCount} Wrong
                                        </div>
                                        <div className={styles.studentAttemptMetric} style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)', background: 'rgba(245, 158, 11, 0.08)' }}>
                                          <AlertCircle size={14} /> {att.skippedCount} Skipped
                                        </div>
                                        <div className={styles.studentAttemptMetric} style={{ color: 'var(--text-secondary)' }}>
                                          <Clock size={14} /> {formatTime(att.timeTakenSeconds)}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleSelectAttempt(att.attemptId)}
                                          className={styles.studentViewAnswersBtn}
                                        >
                                          <FileText size={15} /> View Full Answersheet
                                        </button>
                                      </div>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Level 1: All Students Submissions Table */
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
                                        {st.bestScore.toFixed(1)} Marks
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
                                        onClick={() => handleOpenStudentSubmissions(st.studentId)}
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
                  )}
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
                        {(() => {
                          const maxScore = Math.max(...leaderboard.map(e => e.netScore), 1);
                          return [
                            { label: `Top Range (≥ ${(maxScore * 0.8).toFixed(1)} marks)`, count: leaderboard.filter(e => e.netScore >= maxScore * 0.8).length },
                            { label: `Upper Mid (${(maxScore * 0.6).toFixed(1)} - ${(maxScore * 0.8).toFixed(1)} marks)`, count: leaderboard.filter(e => e.netScore >= maxScore * 0.6 && e.netScore < maxScore * 0.8).length },
                            { label: `Mid Range (${(maxScore * 0.4).toFixed(1)} - ${(maxScore * 0.6).toFixed(1)} marks)`, count: leaderboard.filter(e => e.netScore >= maxScore * 0.4 && e.netScore < maxScore * 0.6).length },
                            { label: `Lower Mid (${(maxScore * 0.2).toFixed(1)} - ${(maxScore * 0.4).toFixed(1)} marks)`, count: leaderboard.filter(e => e.netScore >= maxScore * 0.2 && e.netScore < maxScore * 0.4).length },
                            { label: `Low Range (< ${(maxScore * 0.2).toFixed(1)} marks)`, count: leaderboard.filter(e => e.netScore < maxScore * 0.2).length },
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
                          ));
                        })()}
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
                                {entry.netScore.toFixed(1)} Marks
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
                            <span className={`${styles.analyticsStat} ${q.correctCount / (q.totalAttempts || 1) >= 0.7 ? 'text-success' : q.correctCount / (q.totalAttempts || 1) >= 0.5 ? 'text-warning' : 'text-error'}`}>
                              {q.correctCount} / {q.totalAttempts} correct
                            </span>
                            <span className={styles.analyticsStat}>{q.totalAttempts} attempts</span>
                          </div>
                        </div>

                        <div className={styles.optionDistribution}>
                          {(q.questionType === 'true_false' || q.questionType === 'mcq') ? (
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
                                      {counts.T > 0 && `${counts.T} T`}
                                    </div>
                                    <div className={styles.tfBarFillF} style={{ width: `${fPercentage}%` }} title={`False: ${counts.F}`}>
                                      {counts.F > 0 && `${counts.F} F`}
                                    </div>
                                    <div className={styles.tfBarFillS} style={{ width: `${sPercentage}%` }} title={`Skipped: ${counts.S}`}>
                                      {counts.S > 0 && `${counts.S} S`}
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
                                        Selected by {count} student{count !== 1 ? 's' : ''}
                                      </span>
                                    </span>
                                  </div>
                                  <div className={styles.tfBarContainer}>
                                    <div
                                      className={isCorrect ? styles.tfBarFillT : styles.tfBarFillF}
                                      style={{ width: `${percentage}%` }}
                                      title={`Selected by: ${count}`}
                                    >
                                      {count > 0 && `${count}`}
                                    </div>
                                    <div className={styles.tfBarFillS} style={{ width: `${100 - percentage}%` }} title={`Not Selected: ${q.totalAttempts - count}`}>
                                      {(q.totalAttempts - count) > 0 && `${q.totalAttempts - count}`}
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
                            <span>Most Common Error: <strong>Option {q.mostCommonWrongOption}</strong></span>
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
                <div className={`${styles.attemptScoreValue} ${getScoreColor(attempt.netScore)}`}>
                  {attempt.netScore.toFixed(1)} Marks
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
                    <div className={styles.attemptStatLabel}>Negative Marks</div>
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
                      {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                        question.options?.map((option: any, idx: number) => {
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

                          const displayLetter = String.fromCharCode(65 + idx);

                          return (
                            <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                <span className={styles.optionLetter}>{displayLetter}</span>
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
                        question.options?.map((option: any, optIdx: number) => {
                          const displayLetter = String.fromCharCode(65 + optIdx);
                          const isStudentAnswer = option.letter === question.studentAnswer;
                          const isCorrectAnswer = option.letter === question.correctOption;
                          const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;

                          let optionClass = styles.reviewOption;
                          if (isStudentAnswer && isCorrectAnswer) optionClass += ` ${styles.optionStudentCorrect}`;
                          else if (isWrongAnswer) optionClass += ` ${styles.optionIncorrect}`;
                          else if (isCorrectAnswer) optionClass += ` ${styles.optionCorrect}`;

                          return (
                            <div key={`${question.questionId}-${option.letter}`} className={optionClass}>
                              <span className={styles.optionLetter}>{displayLetter}</span>
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
    </div>
  );
}