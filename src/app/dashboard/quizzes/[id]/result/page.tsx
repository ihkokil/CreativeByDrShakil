'use client';

import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronLeft,
  Download,
  BarChart2,
  Award,
  User,
  Target,
  TrendingUp,
  RotateCcw,
  Check,
  X,
  FileText,
  Search,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import styles from './page.module.css';

interface QuestionReview {
  questionId: string;
  questionText: string;
  questionType: string;
  options: Array<{ letter: string; text: string }>;
  correctOption: string;
  explanation: string | null;
  studentAnswer: string | null;
  isCorrect: boolean;
  isPartial?: boolean;
  isSkipped: boolean;
}

type LeaderboardEntry = {
  rank: number;
  studentName: string;
  netScore: number;
  timeTakenSeconds: number | null;
  attemptNumber: number | null;
  isCurrentUser: boolean;
};

interface AttemptData {
  id: string;
  netScore: number;
  grossScore?: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  partialCount?: number;
  skippedCount: number;
  negativeMarks: number;
  totalMarks?: number;
  timeTakenSeconds: number;
  submittedAt: string;
  attemptNumber: number;
  rank: number | null;
  questionsReview?: QuestionReview[];
}

interface QuizData {
  id: string;
  title: string;
  marksPerCorrect: number;
  allowNegativeMarking: boolean;
  negativeValue: number;
  allowMultipleAttempts: boolean;
  maxAttempts: number | null;
  durationMinutes: number | null;
  totalMarks?: number | null;
  numQuestionsToServe?: number;
  positionType?: string;
}

interface LeaderboardData {
  attempt: AttemptData;
  quiz: QuizData;
  questionsReview: QuestionReview[];
  leaderboard: LeaderboardEntry[];
}

export default function QuizResultPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const attemptId = searchParams ? searchParams.get('attempt') || '' : '';
  const isAutoSubmitted = searchParams ? searchParams.get('auto') === 'true' : false;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;
  
  const tabParam = searchParams ? searchParams.get('tab') : null;
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'leaderboard' | 'answers'>(
    tabParam === 'answers' ? 'answers' : (tabParam === 'leaderboard' ? 'leaderboard' : 'summary')
  );
  const [downloading, setDownloading] = useState(false);
  const [retaking, setRetaking] = useState(false);

  // Leaderboard Windowing, Search, and Filtering
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardViewMode, setLeaderboardViewMode] = useState<'top' | 'around_me' | 'all'>('top');
  const [visibleCount, setVisibleCount] = useState(10);

  const handleRetakeQuiz = async () => {
    if (!data) return;
    setRetaking(true);
    try {
      const res = await fetch(`/api/quiz/${quizId}/start`, {
        method: 'POST',
      });
      const resData = await res.json();
      
      if (!res.ok) {
        throw new Error(resData.error || 'Failed to start quiz');
      }
      
      const targetUrl = returnUrl
        ? `/dashboard/quizzes/${quizId}/attempt/${resData.attemptId}?returnUrl=${encodeURIComponent(returnUrl)}`
        : `/dashboard/quizzes/${quizId}/attempt/${resData.attemptId}`;
      router.push(targetUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to start quiz');
    } finally {
      setRetaking(false);
    }
  };

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}/results?attempt=${attemptId}`);
        const result = await res.json();
        
        if (!res.ok) {
          if (res.status === 403 || res.status === 404) {
            router.push(returnUrl || '/dashboard/quizzes');
            return;
          }
          throw new Error(result.error || 'Failed to load results');
        }
        
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [quizId, attemptId, router]);

  const formatTime = (seconds: number) => {
    if (!seconds && seconds !== 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      return `${hours}h ${mins % 60}m`;
    }
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getScoreColorClass = (percentage: number) => {
    if (percentage >= 80) return styles.colorSuccess;
    if (percentage >= 60) return styles.colorWarning;
    return styles.colorError;
  };

  const handleDownloadPDF = async () => {
    if (!data) return;
    setDownloading(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const paddingX = 20;
      const usableWidth = pdfWidth - (paddingX * 2);
      let currentY = 20;
      
      // Detect current theme background color
      const bodyBgStyle = window.getComputedStyle(document.body).backgroundColor;
      const rgbMatch = bodyBgStyle.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      const bgColor = rgbMatch ? [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])] : [255, 255, 255];
      
      // Fill the first page background
      pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      
      const addElementToPdf = async (el: HTMLElement) => {
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: bodyBgStyle,
          width: el.scrollWidth,
          windowWidth: document.documentElement.scrollWidth,
          scrollX: -window.scrollX,
          scrollY: -window.scrollY
        });
        
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * usableWidth) / canvas.width;
        
        // Add new page if element doesn't fit (and it's not the very top of the page)
        if (currentY + imgHeight > pdfHeight - 20 && currentY > 20) {
          pdf.addPage();
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
          currentY = 20;
        }
        
        pdf.addImage(imgData, 'PNG', paddingX, currentY, usableWidth, imgHeight);
        currentY += imgHeight + 15; // 15px spacing between elements
      };

      // 1. Capture Score Section
      const scoreElement = document.getElementById('score-section');
      if (scoreElement) await addElementToPdf(scoreElement);
      
      // 1.5 Capture Summary Grid
      const summaryGrid = document.getElementById('summary-grid-section');
      if (summaryGrid) await addElementToPdf(summaryGrid);
      
      // 2. Capture Review Header
      const reviewHeader = document.getElementById('review-header-section');
      if (reviewHeader) await addElementToPdf(reviewHeader);
      
      // 3. Capture Each Question Card
      const questionCards = document.querySelectorAll('.pdf-question-card');
      for (let i = 0; i < questionCards.length; i++) {
        await addElementToPdf(questionCards[i] as HTMLElement);
      }
      
      pdf.save(`${data.quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_answers.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

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
          <XCircle className={styles.errorIcon} />
          <h2>Unable to Load Results</h2>
          <p>{error || 'Results not found or access denied'}</p>
          <Link href="/dashboard/quizzes" className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  const attempt = data?.attempt || ({} as any);
  const quiz = data?.quiz || ({} as any);
  const questionsReview = Array.isArray(data?.questionsReview) 
    ? [...data.questionsReview] 
    : (Array.isArray(attempt?.questionsReview) ? [...attempt.questionsReview] : []);
  const leaderboard = Array.isArray(data?.leaderboard) ? data.leaderboard : [];

  const actualCorrectCount = attempt.correctCount !== undefined && attempt.correctCount !== null
    ? attempt.correctCount
    : questionsReview.filter(q => q && q.isCorrect).length;
  const actualPartialCount = attempt.partialCount !== undefined && attempt.partialCount !== null
    ? attempt.partialCount
    : questionsReview.filter(q => q && q.isPartial).length;
  const actualSkippedCount = attempt.skippedCount !== undefined && attempt.skippedCount !== null
    ? attempt.skippedCount
    : questionsReview.filter(q => q && q.isSkipped).length;
  const actualWrongCount = attempt.wrongCount !== undefined && attempt.wrongCount !== null
    ? attempt.wrongCount
    : questionsReview.filter(q => q && !q.isCorrect && !q.isPartial && !q.isSkipped).length;
  const totalQs = quiz.numQuestionsToServe || questionsReview.length || (actualCorrectCount + actualPartialCount + actualWrongCount + actualSkippedCount) || 1;
  
  // Calculate scores based on question types (SBA: 2 correct/-1 wrong, True_False: 2 correct/-0.5 per wrong option)
  const marksPerCorrect = quiz.marksPerCorrect || 1;
  const negativeValue = quiz.negativeValue || 0;
  
  // Calculate raw scores from question reviews
  let rawCorrectScore = 0;
  let rawWrongScore = 0;
  let rawSkippedCount = 0;
  
  questionsReview.forEach(q => {
    if (!q) return;
    if (q.isCorrect) {
      rawCorrectScore += marksPerCorrect;
    } else if (q.isPartial) {
      rawCorrectScore += marksPerCorrect * 0.5; // approximate partial
    } else if (q.isSkipped) {
      rawSkippedCount++;
    } else if (q.isCorrect === false) {
      rawWrongScore += negativeValue;
    }
  });
  
  // Net score = correct - wrong (netScore from attempt should already reflect this)
  const netScore = attempt.netScore !== undefined && attempt.netScore !== null 
    ? attempt.netScore 
    : rawCorrectScore + rawWrongScore;
  const grossScore = netScore - rawWrongScore; // net already subtracted negatives, so gross = net + wrongs
  const partialMarksEarned = Math.max(0, rawCorrectScore - marksPerCorrect * actualCorrectCount);
  
  // Recalculate: total possible marks
  const totalMarks = attempt.totalMarks || quiz.totalMarks || (totalQs * marksPerCorrect) || 1;
  const percentageScore = attempt.percentageScore !== undefined && attempt.percentageScore !== null 
    ? attempt.percentageScore 
    : Math.min(100, Math.max(0, ((netScore || 0) / totalMarks) * 100));

  // Leaderboard Windowing Calculations
  const userRankIndex = leaderboard.findIndex(e => e.isCurrentUser);
  const currentUserEntry = userRankIndex >= 0 ? leaderboard[userRankIndex] : null;

  const isSearching = leaderboardSearch.trim() !== '';
  const searchFilteredList = isSearching
    ? leaderboard.filter(e => e.studentName.toLowerCase().includes(leaderboardSearch.toLowerCase().trim()))
    : leaderboard;

  let displayedLeaderboard: LeaderboardEntry[] = [];
  let viewTitleNote = '';

  if (isSearching) {
    displayedLeaderboard = searchFilteredList;
    viewTitleNote = `Showing ${displayedLeaderboard.length} of ${leaderboard.length} participants matching "${leaderboardSearch.trim()}"`;
  } else if (leaderboardViewMode === 'all') {
    displayedLeaderboard = leaderboard;
    viewTitleNote = `Showing all ${leaderboard.length} participants`;
  } else if (leaderboardViewMode === 'around_me' && userRankIndex >= 0) {
    const start = Math.max(0, userRankIndex - 5);
    const end = Math.min(leaderboard.length, userRankIndex + 6);
    displayedLeaderboard = leaderboard.slice(start, end);
    viewTitleNote = `Showing entries around your rank (Rank #${currentUserEntry?.rank})`;
  } else {
    // 'top' mode
    displayedLeaderboard = leaderboard.slice(0, visibleCount);
    viewTitleNote = `Showing top ${Math.min(visibleCount, leaderboard.length)} of ${leaderboard.length} participants`;
  }

  return (
    <div className={styles.container}>
      <div id="quiz-result-content">
        <header className={styles.header}>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backLink}>
            <ChevronLeft className={styles.backIcon} />
            {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
          </Link>
        </header>

        {/* Contextual Header Banner (Smooth Transitions) */}
        {activeTab === 'summary' ? (
          <section id="score-section" className={styles.scoreSection}>
            <div className={styles.scoreCard}>
              <div className={styles.scoreCardTop}>
                <div className={styles.scoreCardLeft}>
                  <div className={styles.quizHeader}>
                    <h1 className={styles.quizTitle}>{quiz.title}</h1>
                    <div className={styles.quizMeta}>
                      <span className={styles.metaItem}>
                        <Target className={styles.metaIcon} /> Attempt #{attempt.attemptNumber}
                      </span>
                      <span className={styles.metaItem}>
                        <Clock className={styles.metaIcon} /> {formatTime(attempt.timeTakenSeconds)}
                      </span>
                      {attempt.rank && (
                        <span className={styles.metaItem}>
                          <Trophy className={styles.metaIcon} /> Rank #{attempt.rank} / {leaderboard.length}
                        </span>
                      )}
                    </div>
                    
                    {isAutoSubmitted && (
                      <div className={styles.autoSubmitBadge}>
                        <Clock className={styles.badgeIcon} />
                        Auto-submitted (time expired)
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={styles.scoreCardRight}>
                  <div 
                    className={styles.scoreCircle}
                    style={{
                      background: `conic-gradient(var(--success-color) 0% ${actualCorrectCount / totalQs * 100}%, var(--info-color) ${actualCorrectCount / totalQs * 100}% ${(actualCorrectCount + actualPartialCount) / totalQs * 100}%, var(--error-color) ${(actualCorrectCount + actualPartialCount) / totalQs * 100}% ${(actualCorrectCount + actualPartialCount + actualWrongCount) / totalQs * 100}%, var(--border-color) ${(actualCorrectCount + actualPartialCount + actualWrongCount) / totalQs * 100}% 100%)`
                    }}
                    role="img"
                    aria-label={`Score: ${Number(attempt.netScore || 0).toFixed(1)} out of ${totalMarks.toFixed(1)} marks (${percentageScore.toFixed(1)}%)`}
                  >
                    <div className={styles.scoreInner}>
                      <span className={`${styles.scoreValue} ${getScoreColorClass(percentageScore)}`}>
                        {Number(attempt.netScore || 0).toFixed(1)}
                      </span>
                      <span className={styles.scoreTotalDenominator}>/ {totalMarks.toFixed(1)} Marks</span>
                      <span className={styles.scorePercentLabel}>{percentageScore.toFixed(1)}% Accuracy</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.scoreDetails}>
                <div className={styles.detailRow}>
                  <div className={styles.detailItem}>
                    <div className={`${styles.detailValue} ${styles.colorSuccess}`}>{actualCorrectCount}</div>
                    <div className={styles.detailLabel}>Correct</div>
                  </div>
                  {actualPartialCount > 0 && (
                    <>
                      <div className={styles.detailDivider} />
                      <div className={styles.detailItem}>
                        <div className={`${styles.detailValue} ${styles.colorWarning}`}>{actualPartialCount}</div>
                        <div className={styles.detailLabel}>Partial</div>
                      </div>
                    </>
                  )}
                  <div className={styles.detailDivider} />
                  <div className={styles.detailItem}>
                    <div className={`${styles.detailValue} ${styles.colorError}`}>{actualWrongCount}</div>
                    <div className={styles.detailLabel}>Wrong</div>
                  </div>
                  <div className={styles.detailDivider} />
                  <div className={styles.detailItem}>
                    <div className={`${styles.detailValue} ${styles.colorMuted}`}>{actualSkippedCount}</div>
                    <div className={styles.detailLabel}>Skipped</div>
                  </div>
                </div>
                
                {Number(attempt.negativeMarks || 0) > 0 && (
                  <div className={styles.negativeMarks}>
                    <XCircle className={styles.negativeIcon} />
                    <span>Negative marks deducted: <strong>{Number(attempt.negativeMarks).toFixed(2)}</strong></span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : activeTab === 'answers' ? (
          <section className={styles.scoreSection} style={{ marginBottom: '20px' }}>
            <div className={styles.scoreCard} style={{ padding: '24px 28px' }}>
              <h1 className={styles.quizTitle} style={{ fontSize: '24px', marginBottom: '8px' }}>{quiz.title}</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                Official Question Bank Answer Keys & Detailed Explanations
              </p>
            </div>
          </section>
        ) : (
          <section className={styles.scoreSection} style={{ marginBottom: '20px' }}>
            <div className={styles.scoreCard} style={{ padding: '24px 28px' }}>
              <h1 className={styles.quizTitle} style={{ fontSize: '24px', marginBottom: '8px' }}>{quiz.title}</h1>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                Real-Time Peer Leaderboard & Cohort Performance Rankings ({leaderboard.length} Participants)
              </p>
            </div>
          </section>
        )}

        {/* Tab Navigation */}
        <nav className={styles.tabNav} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'summary'}
            aria-controls="panel-summary"
            id="tab-summary"
            onClick={() => setActiveTab('summary')}
            className={`${styles.tabBtn} ${activeTab === 'summary' ? styles.tabActive : ''}`}
          >
            <BarChart2 className={styles.tabIcon} />
            Attempt Analysis
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'answers'}
            aria-controls="panel-answers"
            id="tab-answers"
            onClick={() => setActiveTab('answers')}
            className={`${styles.tabBtn} ${activeTab === 'answers' ? styles.tabActive : ''}`}
          >
            <FileText className={styles.tabIcon} />
            Review Answers & Explanations
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'leaderboard'}
            aria-controls="panel-leaderboard"
            id="tab-leaderboard"
            onClick={() => setActiveTab('leaderboard')}
            className={`${styles.tabBtn} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
          >
            <Trophy className={styles.tabIcon} />
            Leaderboard ({leaderboard.length})
          </button>
        </nav>

        {/* Tab Panels */}
        <div className={styles.tabContent}>
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div id="panel-summary" className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-summary">
              <div id="summary-grid-section" className={styles.summaryGrid}>
                {/* Card 1: Score Breakdown (Top-Left) */}
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <TrendingUp className={styles.cardIcon} />
                    Score Breakdown
                  </h3>
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Marks Gained</span>
                      <span className={`${styles.breakdownValue} ${styles.colorSuccess}`}>
                        +{Number(attempt.grossScore !== undefined && attempt.grossScore !== null ? attempt.grossScore : (netScore + Number(attempt.negativeMarks || 0))).toFixed(2)}
                      </span>
                    </div>
                    {Number(attempt.negativeMarks || 0) > 0 && (
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Negative Penalty</span>
                        <span className={`${styles.breakdownValue} ${styles.colorError}`}>
                          -{Number(attempt.negativeMarks).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className={styles.breakdownTotal}>
                      <span>Total Net Score</span>
                      <span className={getScoreColorClass(percentageScore)}>{Number(attempt.netScore || 0).toFixed(2)} Marks</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Accuracy Breakdown (Top-Right) */}
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <Target className={styles.cardIcon} />
                    Accuracy Breakdown
                  </h3>
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Overall Accuracy</span>
                      <span className={`${styles.breakdownValue} ${getScoreColorClass(percentageScore)}`}>
                        {percentageScore.toFixed(1)}%
                      </span>
                    </div>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Questions Answered</span>
                      <span className={styles.breakdownValue}>
                        {actualCorrectCount + actualPartialCount + actualWrongCount} / {totalQs}
                      </span>
                    </div>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Questions Skipped</span>
                      <span className={`${styles.breakdownValue} ${styles.colorMuted}`}>
                        {actualSkippedCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Time & Efficiency (Bottom-Left) */}
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <Clock className={styles.cardIcon} />
                    Time & Efficiency
                  </h3>
                  <div className={styles.timeAnalysis}>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Time Taken</span>
                      <span className={styles.timeValue}>{formatTime(attempt.timeTakenSeconds)}</span>
                    </div>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Time Limit</span>
                      <span className={styles.timeValue}>{quiz.durationMinutes ? `${quiz.durationMinutes}m` : 'Unlimited'}</span>
                    </div>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Pace</span>
                      <span className={styles.timeValue}>
                        {totalQs > 0 
                          ? `${(attempt.timeTakenSeconds / totalQs).toFixed(0)}s per question`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 4: Dynamic Rank & Position (Bottom-Right) */}
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <Award className={styles.cardIcon} />
                    Dynamic Rank & Position
                  </h3>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankMain}>
                      <span className={styles.rankLabel}>Your Rank</span>
                      <span className={styles.rankValue}>#{attempt.rank || '—'}</span>
                    </div>
                    <div className={styles.rankLabel}>out of {leaderboard.length} participant{leaderboard.length !== 1 ? 's' : ''}</div>
                    <div className={styles.rankMethod}>
                      Ranking: {quiz.positionType ? 
                        (quiz.positionType === 'first_attempt' ? 'First Attempt' : 
                         quiz.positionType === 'last_attempt' ? 'Last Attempt' : 
                         quiz.positionType === 'average_attempt' ? 'Average Attempt' : 'Best Attempt')
                        : (attempt.attemptNumber === 1 ? 'First Attempt' : 'Best Attempt')} • Tie-breaker: Time taken
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons Top */}
              <div className={styles.actions}>
                <Link href={returnUrl || "/dashboard/quizzes"} className={styles.secondaryBtn}>
                  <ChevronLeft className={styles.btnIcon} />
                  {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
                </Link>
                <Link href={`/dashboard/quizzes/${quizId}/attempts${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} className={styles.secondaryBtn}>
                  <Trophy className={styles.btnIcon} />
                  All Attempts
                </Link>
                {quiz.allowMultipleAttempts && (!quiz.maxAttempts || attempt.attemptNumber < quiz.maxAttempts) && (
                  <button type="button" onClick={handleRetakeQuiz} disabled={retaking} className={styles.retakeBtn}>
                    <RotateCcw className={styles.btnIcon} />
                    {retaking ? 'Starting...' : 'Retake Quiz'}
                  </button>
                )}
                <button type="button" onClick={handleDownloadPDF} disabled={downloading} className={styles.downloadBtn}>
                  <Download className={styles.btnIcon} />
                  {downloading ? 'Generating...' : 'Download Result (PDF)'}
                </button>
              </div>

              {/* Answer Review Section */}
              <div id="answer-review-section" className={styles.reviewSectionWrapper}>
                <div id="review-header-section" className={styles.reviewHeader}>
                  <h2 className={styles.reviewTitle}>Answer Review & Explanations</h2>
                  <div className={styles.reviewStats}>
                    <span className={`${styles.reviewStat} ${styles.reviewStatSuccess}`}>
                      <CheckCircle className={styles.reviewIcon} /> {actualCorrectCount} Correct
                    </span>
                    {actualPartialCount > 0 && (
                      <span className={`${styles.reviewStat} ${styles.reviewStatWarning}`}>
                        <CheckCircle className={styles.reviewIcon} /> {actualPartialCount} Partial
                      </span>
                    )}
                    <span className={`${styles.reviewStat} ${styles.reviewStatError}`}>
                      <XCircle className={styles.reviewIcon} /> {actualWrongCount} Wrong
                    </span>
                    <span className={`${styles.reviewStat} ${styles.reviewStatMuted}`}>
                      <HelpCircle className={styles.reviewIcon} /> {actualSkippedCount} Skipped
                    </span>
                  </div>
                </div>
                
                <div className={styles.reviewList}>
                  {questionsReview.map((question, index) => (
                    <article key={question.questionId} className={`${styles.reviewCard} pdf-question-card ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                      <div className={styles.reviewCardHeader}>
                        <div className={styles.reviewQuestionInfo}>
                          <span className={styles.reviewNumber}>Q{index + 1}</span>
                          <span className={`${styles.reviewStatus} ${question.isSkipped ? styles.skipped : question.isPartial ? styles.partial : question.isCorrect ? styles.correct : styles.incorrect}`}>
                            {question.isSkipped ? '— Skipped' : question.isPartial ? '◐ Partial' : question.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        </div>
                      </div>
                      
                      <h3 className={styles.reviewQuestionText}>{question.questionText}</h3>
                                  <div className={styles.reviewOptions}>
                        {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                          question.options.map((option) => {
                             const studentStr = question.studentAnswer || '-'.repeat(question.options.length || 5);
                             const correctStr = question.correctOption || 'F'.repeat(question.options.length || 5);
                             const originalIdx = option.letter.charCodeAt(0) - 65;
                             const isT = studentStr[originalIdx] === 'T';
                             const isF = studentStr[originalIdx] === 'F';
                             const isCorrectT = correctStr[originalIdx] === 'T';
                             const isCorrectF = correctStr[originalIdx] === 'F';
                             const answered = isT || isF;
                             const isCorrect = (isT && isCorrectT) || (isF && isCorrectF);
                             
                             let rowStatusClass = styles.tfCompactSkipped;
                             if (answered) {
                               rowStatusClass = isCorrect ? styles.tfCompactCorrect : styles.tfCompactIncorrect;
                             }
                             
                             return (
                                <div key={`${question.questionId}-${option.letter}`} className={`${styles.tfCompactRow} ${rowStatusClass}`}>
                                  {/* Left: Letter Badge + Statement Text */}
                                  <div className={styles.tfCompactLeft}>
                                    <span className={styles.optionLetter}>{option.letter}</span>
                                    <span className={styles.tfCompactText}>{option.text}</span>
                                  </div>

                                  {/* Right: User's Choice + Correct Option Badge + Status Chip */}
                                  <div className={styles.tfCompactRight}>
                                    {/* User's choice (Lightly highlighted) */}
                                    {answered ? (
                                      <div className={isCorrect ? styles.userPillCorrect : styles.userPillWrong} title="Your answered option">
                                        {isCorrect ? <Check size={13} /> : <X size={13} />}
                                        <span>You: {isT ? 'True' : 'False'}</span>
                                      </div>
                                    ) : (
                                      <div className={styles.userPillSkipped} title="You skipped this statement">
                                        <span>You: —</span>
                                      </div>
                                    )}

                                    {/* Official Correct Option (Boldly highlighted) */}
                                    <div className={styles.keyPill} title="Official correct option">
                                      <Check size={12} />
                                      <span>Correct: {isCorrectT ? 'True' : 'False'}</span>
                                    </div>

                                    {/* Outcome Badge */}
                                    <div className={styles.outcomeBadgeWrapper}>
                                      {answered && isCorrect && (
                                        <span className={styles.tfOutcomeSuccess}>
                                          <Check size={12} /> Correct
                                        </span>
                                      )}
                                      {answered && !isCorrect && (
                                        <span className={styles.tfOutcomeDanger}>
                                          <X size={12} /> Wrong
                                        </span>
                                      )}
                                      {!answered && (
                                        <span className={styles.tfOutcomeMuted}>
                                          &mdash; Skipped
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                             );
                          })
                        ) : (
                          question.options.map(option => {
                            const isStudentAnswer = option.letter === question.studentAnswer;
                            const isCorrectAnswer = option.letter === question.correctOption;
                            const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;
                            
                            let sbaClass = styles.sbaNeutral;
                            if (isStudentAnswer && isCorrectAnswer) sbaClass = styles.sbaCorrect;
                            else if (isWrongAnswer) sbaClass = styles.sbaIncorrect;
                            else if (isCorrectAnswer) sbaClass = styles.sbaKeyHighlight;
                            
                            return (
                              <div key={`${question.questionId}-${option.letter}`} className={`${styles.sbaReviewRow} ${sbaClass}`}>
                                <div className={styles.sbaRowLeft}>
                                  <span className={styles.optionLetter}>{option.letter}</span>
                                  <span className={styles.optionText}>{option.text}</span>
                                </div>
                                <div className={styles.sbaRowRight}>
                                  {isStudentAnswer && isCorrectAnswer && (
                                    <span className={styles.sbaBadgeSuccess}><Check size={13} /> Your Answer (Correct)</span>
                                  )}
                                  {isWrongAnswer && (
                                    <span className={styles.sbaBadgeDanger}><X size={13} /> Your Answer (Wrong)</span>
                                  )}
                                  {!isStudentAnswer && isCorrectAnswer && (
                                    <span className={styles.sbaBadgeKey}><Check size={13} /> Correct Option</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      {question.explanation && question.explanation.trim() !== '' && (
                        <div className={styles.explanation}>
                          <HelpCircle className={styles.explanationIcon} />
                          <div>
                            <strong>Medical Explanation:</strong>
                            <p>{question.explanation}</p>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                {/* Bottom Actions repeated for convenience */}
                <div className={styles.actions} style={{ marginTop: '32px' }}>
                  <Link href={returnUrl || "/dashboard/quizzes"} className={styles.secondaryBtn}>
                    <ChevronLeft className={styles.btnIcon} />
                    {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
                  </Link>
                  <Link href={`/dashboard/quizzes/${quizId}/attempts${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} className={styles.secondaryBtn}>
                    <Trophy className={styles.btnIcon} />
                    All Attempts
                  </Link>
                  {quiz.allowMultipleAttempts && (!quiz.maxAttempts || attempt.attemptNumber < quiz.maxAttempts) && (
                    <button type="button" onClick={handleRetakeQuiz} disabled={retaking} className={styles.retakeBtn}>
                      <RotateCcw className={styles.btnIcon} />
                      {retaking ? 'Starting...' : 'Retake Quiz'}
                    </button>
                  )}
                  <button type="button" onClick={handleDownloadPDF} disabled={downloading} className={styles.downloadBtn}>
                    <Download className={styles.btnIcon} />
                    {downloading ? 'Generating...' : 'Download Result (PDF)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pure Answer Key & Explanations Tab (No Score/Stats) */}
          {activeTab === 'answers' && (
            <div id="panel-answers" className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-answers">
              <div className={styles.reviewSectionWrapper} style={{ marginTop: 0 }}>
                <div className={styles.reviewHeader}>
                  <div>
                    <h2 className={styles.reviewTitle}>Official Answer Keys & Explanations</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Pure educational review of all questions, correct answer keys, and medical rationales.
                    </p>
                  </div>
                  <span className={styles.reviewNumber} style={{ fontSize: '13px', padding: '5px 12px' }}>
                    {questionsReview.length} Questions
                  </span>
                </div>

                <div className={styles.reviewList}>
                  {questionsReview.map((question, index) => (
                    <article key={`ans-${question.questionId}`} className={styles.reviewCard} style={{ borderLeftColor: '#0284c7' }}>
                      <div className={styles.reviewCardHeader}>
                        <div className={styles.reviewQuestionInfo}>
                          <span className={styles.reviewNumber}>Q{index + 1}</span>
                          <span style={{ 
                            fontSize: '11.5px', 
                            fontWeight: 700, 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            background: (question.questionType === 'true_false' || question.questionType === 'mcq') ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                            color: (question.questionType === 'true_false' || question.questionType === 'mcq') ? '#3b82f6' : '#a855f7',
                            border: '1px solid currentColor'
                          }}>
                            {(question.questionType === 'true_false' || question.questionType === 'mcq') ? 'True / False Matrix' : 'Single Best Answer'}
                          </span>
                        </div>
                      </div>

                      <h3 className={styles.reviewQuestionText}>{question.questionText}</h3>

                      <div className={styles.reviewOptions}>
                        {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                          question.options.map((option) => {
                            const correctStr = question.correctOption || 'F'.repeat(question.options.length || 5);
                            const originalIdx = option.letter.charCodeAt(0) - 65;
                            const isCorrectT = correctStr[originalIdx] === 'T';

                            return (
                              <div key={`key-${question.questionId}-${option.letter}`} className={styles.tfCompactRow} style={{ borderColor: 'var(--border-color)' }}>
                                <div className={styles.tfCompactLeft}>
                                  <span className={styles.optionLetter}>{option.letter}</span>
                                  <span className={styles.tfCompactText}>{option.text}</span>
                                </div>
                                <div className={styles.tfCompactRight}>
                                  <div className={isCorrectT ? styles.keyPillTrue : styles.keyPillFalse}>
                                    <Check size={13} />
                                    <span>Correct: {isCorrectT ? 'TRUE' : 'FALSE'}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          question.options.map((option) => {
                            const isCorrectAnswer = option.letter === question.correctOption;

                            return (
                              <div 
                                key={`key-${question.questionId}-${option.letter}`} 
                                className={`${styles.sbaReviewRow} ${isCorrectAnswer ? styles.sbaCorrect : styles.sbaNeutral}`}
                              >
                                <div className={styles.sbaRowLeft}>
                                  <span className={styles.optionLetter}>{option.letter}</span>
                                  <span className={styles.optionText} style={{ fontWeight: isCorrectAnswer ? 600 : 400 }}>
                                    {option.text}
                                  </span>
                                </div>
                                <div className={styles.sbaRowRight}>
                                  {isCorrectAnswer && (
                                    <span className={styles.sbaBadgeSuccess}>
                                      <Check size={13} /> Correct Option
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {question.explanation && question.explanation.trim() !== '' && (
                        <div className={styles.explanation} style={{ marginTop: '14px' }}>
                          <HelpCircle className={styles.explanationIcon} />
                          <div>
                            <strong>Medical Explanation:</strong>
                            <p>{question.explanation}</p>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <div className={styles.actions} style={{ marginTop: '32px' }}>
                  <Link href={returnUrl || "/dashboard/quizzes"} className={styles.secondaryBtn}>
                    <ChevronLeft className={styles.btnIcon} />
                    {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
                  </Link>
                  {quiz.allowMultipleAttempts && (!quiz.maxAttempts || attempt.attemptNumber < quiz.maxAttempts) && (
                    <button type="button" onClick={handleRetakeQuiz} disabled={retaking} className={styles.retakeBtn}>
                      <RotateCcw className={styles.btnIcon} />
                      {retaking ? 'Starting...' : 'Retake Quiz'}
                    </button>
                  )}
                  <button type="button" onClick={handleDownloadPDF} disabled={downloading} className={styles.downloadBtn}>
                    <Download className={styles.btnIcon} />
                    {downloading ? 'Generating...' : 'Download Result (PDF)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div id="panel-leaderboard" className={styles.tabPanel} role="tabpanel" aria-labelledby="tab-leaderboard">
              <div className={styles.leaderboardContainer}>
                {/* 1. Current User Standing Banner */}
                {currentUserEntry && (
                  <div className={styles.standingCard}>
                    <div className={styles.standingLeft}>
                      <div className={styles.standingRankBadge}>
                        {currentUserEntry.rank === 1 ? '🥇 1st Place' : currentUserEntry.rank === 2 ? '🥈 2nd Place' : currentUserEntry.rank === 3 ? '🥉 3rd Place' : `Rank #${currentUserEntry.rank}`}
                      </div>
                      <div className={styles.standingInfo}>
                        <span className={styles.standingName}>{currentUserEntry.studentName} (You)</span>
                        <span className={styles.standingMeta}>
                          Score: <strong>{currentUserEntry.netScore.toFixed(1)} Marks</strong> • Time: <strong>{currentUserEntry.timeTakenSeconds ? formatTime(currentUserEntry.timeTakenSeconds) : '—'}</strong> • Attempt: <strong>#{currentUserEntry.attemptNumber || 1}</strong>
                        </span>
                      </div>
                    </div>
                    <div className={styles.standingRight}>
                      <button
                        type="button"
                        className={styles.jumpToMeBtn}
                        onClick={() => {
                          setLeaderboardSearch('');
                          setLeaderboardViewMode('around_me');
                        }}
                      >
                        <Target size={15} />
                        <span>View Around My Rank</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Controls & Search Toolbar */}
                <div className={styles.leaderboardToolbar}>
                  <div className={styles.searchBox}>
                    <Search className={styles.searchIcon} size={16} />
                    <input
                      type="text"
                      placeholder="Search participant name..."
                      value={leaderboardSearch}
                      onChange={(e) => setLeaderboardSearch(e.target.value)}
                      className={styles.searchInput}
                    />
                    {leaderboardSearch && (
                      <button
                        type="button"
                        className={styles.searchClearBtn}
                        onClick={() => setLeaderboardSearch('')}
                        aria-label="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {!isSearching && leaderboard.length > 10 && (
                    <div className={styles.filterPillsGroup}>
                      <button
                        type="button"
                        className={`${styles.filterPill} ${leaderboardViewMode === 'top' ? styles.filterPillActive : ''}`}
                        onClick={() => {
                          setLeaderboardViewMode('top');
                          setVisibleCount(10);
                        }}
                      >
                        Top 10
                      </button>
                      {userRankIndex >= 0 && (
                        <button
                          type="button"
                          className={`${styles.filterPill} ${leaderboardViewMode === 'around_me' ? styles.filterPillActive : ''}`}
                          onClick={() => setLeaderboardViewMode('around_me')}
                        >
                          Around Me (#{currentUserEntry?.rank})
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${styles.filterPill} ${leaderboardViewMode === 'all' ? styles.filterPillActive : ''}`}
                        onClick={() => setLeaderboardViewMode('all')}
                      >
                        Show All ({leaderboard.length})
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.leaderboardSubHeader}>
                  <h2 className={styles.leaderboardTitle}>
                    <Trophy className={styles.leaderboardIcon} />
                    {viewTitleNote}
                  </h2>
                </div>
                
                {displayedLeaderboard.length === 0 ? (
                  <div className={styles.emptyLeaderboard}>
                    <Trophy className={styles.emptyIcon} />
                    <p>{isSearching ? `No participants found matching "${leaderboardSearch}".` : 'No participant results submitted yet.'}</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop View Table */}
                    <div className={styles.tableWrapper}>
                      <table className={styles.leaderboardTable} role="table">
                        <thead>
                          <tr>
                            <th scope="col">Rank</th>
                            <th scope="col">Participant</th>
                            <th scope="col">Net Score</th>
                            <th scope="col">Time Taken</th>
                            <th scope="col">Attempt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedLeaderboard.map((entry) => {
                            const entryPercentage = totalMarks > 0 ? (entry.netScore / totalMarks) * 100 : 0;
                            return (
                              <tr key={`${entry.rank}-${entry.studentName}`} className={entry.isCurrentUser ? styles.currentUser : ''}>
                                <td className={styles.rankCell}>
                                  {entry.rank <= 3 ? (
                                    <span className={styles.medal} aria-label={`Rank ${entry.rank}`}>
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
                                  <span className={getScoreColorClass(entryPercentage)}>
                                    {entry.netScore.toFixed(1)} Marks
                                  </span>
                                </td>
                                <td className={styles.timeCell}>
                                  {entry.timeTakenSeconds ? formatTime(entry.timeTakenSeconds) : '—'}
                                </td>
                                <td className={styles.attemptCell}>
                                  #{entry.attemptNumber || 1}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View Card List (Zero Horizontal Scroll) */}
                    <div className={styles.leaderboardMobileList}>
                      {displayedLeaderboard.map((entry) => {
                        const entryPercentage = totalMarks > 0 ? (entry.netScore / totalMarks) * 100 : 0;
                        return (
                          <div
                            key={`mob-${entry.rank}-${entry.studentName}`}
                            className={`${styles.mobileEntryCard} ${entry.isCurrentUser ? styles.mobileEntryCurrentUser : ''}`}
                          >
                            <div className={styles.mobileCardTop}>
                              <div className={styles.mobileRankAndName}>
                                <div className={styles.mobileRankBadge}>
                                  {entry.rank <= 3 ? (
                                    entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'
                                  ) : (
                                    `#${entry.rank}`
                                  )}
                                </div>
                                <span className={styles.mobileStudentName}>{entry.studentName}</span>
                                {entry.isCurrentUser && <span className={styles.mobileYouTag}>You</span>}
                              </div>
                              <div className={styles.mobileScoreBadge}>
                                <span className={getScoreColorClass(entryPercentage)}>
                                  {entry.netScore.toFixed(1)} Marks
                                </span>
                              </div>
                            </div>
                            <div className={styles.mobileCardBottom}>
                              <span>⏱ {entry.timeTakenSeconds ? formatTime(entry.timeTakenSeconds) : '—'}</span>
                              <span>•</span>
                              <span>Attempt #{entry.attemptNumber || 1}</span>
                              <span>•</span>
                              <span>{entryPercentage.toFixed(0)}% Accuracy</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Load More Controls for 'top' mode */}
                    {!isSearching && leaderboardViewMode === 'top' && visibleCount < leaderboard.length && (
                      <div className={styles.loadMoreContainer}>
                        <button
                          type="button"
                          className={styles.loadMoreBtn}
                          onClick={() => setVisibleCount(prev => Math.min(leaderboard.length, prev + 10))}
                        >
                          <span>Load Next 10 Participants</span>
                          <span className={styles.loadMoreCount}>({visibleCount} of {leaderboard.length})</span>
                        </button>
                        <button
                          type="button"
                          className={styles.showAllLinkBtn}
                          onClick={() => setLeaderboardViewMode('all')}
                        >
                          Show All {leaderboard.length}
                        </button>
                      </div>
                    )}

                    {/* Return to Top 10 link when in around_me or all mode */}
                    {!isSearching && leaderboardViewMode !== 'top' && leaderboard.length > 10 && (
                      <div className={styles.loadMoreContainer}>
                        <button
                          type="button"
                          className={styles.loadMoreBtn}
                          onClick={() => {
                            setLeaderboardViewMode('top');
                            setVisibleCount(10);
                          }}
                        >
                          <ChevronLeft size={16} />
                          <span>Back to Top 10</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
                
                <p className={styles.leaderboardNote}>
                  Rankings update in real-time as peers complete attempts. {leaderboard.length > 0 ? `Total participants: ${leaderboard.length}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}