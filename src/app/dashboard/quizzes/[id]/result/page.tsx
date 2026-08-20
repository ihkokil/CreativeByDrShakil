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
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  negativeMarks: number;
  timeTakenSeconds: number;
  submittedAt: string;
  attemptNumber: number;
  rank: number | null;
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
  
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'leaderboard'>('summary');
  const [downloading, setDownloading] = useState(false);
  const [retaking, setRetaking] = useState(false);

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
  const questionsReview = Array.isArray(data?.questionsReview) ? [...data.questionsReview] : [];
  const leaderboard = Array.isArray(data?.leaderboard) ? data.leaderboard : [];

  const actualCorrectCount = questionsReview.filter(q => q && q.isCorrect).length;
  const actualPartialCount = questionsReview.filter(q => q && q.isPartial).length;
  const actualSkippedCount = questionsReview.filter(q => q && q.isSkipped).length;
  const actualWrongCount = questionsReview.filter(q => q && !q.isCorrect && !q.isPartial && !q.isSkipped).length;
  const totalQs = questionsReview.length || 1;
  
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
      // Partial - count how many options were answered correctly vs incorrectly
      // For SBA: partial means some correct some wrong, scored proportionally
      // For True_False: handled separately based on option correctness
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
  
  // Recalculate: total possible marks = all questions × marks per correct
  const numQuestions = quiz.numQuestionsToServe || questionsReview.length || 1;
  const totalMarks = quiz.totalMarks || (numQuestions * marksPerCorrect) || 1;
  const percentageScore = attempt.percentageScore !== undefined && attempt.percentageScore !== null 
    ? attempt.percentageScore 
    : Math.min(100, Math.max(0, ((netScore || 0) / totalMarks) * 100));

  const topLeaderboard = leaderboard.slice(0, 20);

  return (
    <div className={styles.container}>
      <div id="quiz-result-content">
        <header className={styles.header}>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backLink}>
            <ChevronLeft className={styles.backIcon} />
            {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
          </Link>
        </header>

        {/* Score Summary */}
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
              
              {quiz.allowNegativeMarking && attempt.negativeMarks > 0 && (
                <div className={styles.negativeMarks}>
                  <XCircle className={styles.negativeIcon} />
                  <span>Negative marks deducted: <strong>{attempt.negativeMarks.toFixed(2)}</strong> ({quiz.negativeValue} marks per wrong answer)</span>
                </div>
              )}
            </div>
          </div>
        </section>

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
            Summary & Review
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
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <TrendingUp className={styles.cardIcon} />
                    Score Breakdown
                  </h3>
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Correct Answers</span>
                      <span className={`${styles.breakdownValue} ${styles.colorSuccess}`}>
                        {actualCorrectCount} × {quiz.marksPerCorrect} = {(actualCorrectCount * quiz.marksPerCorrect).toFixed(1)}
                      </span>
                    </div>
                    {actualPartialCount > 0 && (
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Partial Marks</span>
                        <span className={`${styles.breakdownValue} ${styles.colorWarning}`}>
                          +{partialMarksEarned.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {quiz.allowNegativeMarking && actualWrongCount > 0 && (
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Wrong Answers Penalty</span>
                        <span className={`${styles.breakdownValue} ${styles.colorError}`}>
                          -{Number(attempt.negativeMarks || 0).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className={styles.breakdownTotal}>
                      <span>Total Net Score</span>
                      <span className={getScoreColorClass(percentageScore)}>{Number(attempt.netScore || 0).toFixed(2)} Marks</span>
                    </div>
                  </div>
                </div>

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
              </div>

              {/* Action Buttons Top */}
              <div className={styles.actions}>
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
                        {question.questionType === 'mcq' ? (
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
                             
                             let optionClass = styles.reviewOption;
                             if (answered) {
                               if (isCorrect) optionClass += ` ${styles.optionStudentCorrect}`;
                               else optionClass += ` ${styles.optionIncorrect}`;
                             }
                             
                             return (
                                <div key={`${question.questionId}-${option.letter}`} className={optionClass} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '11px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <span className={styles.optionLetter}>{option.letter}</span>
                                    <span className={styles.optionText}>{option.text}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                    {/* True Pill */}
                                    <div style={{ 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                      minWidth: '66px', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                      background: isT ? (isCorrectT ? 'rgba(5, 150, 105, 0.14)' : 'rgba(220, 38, 38, 0.14)') : (isCorrectT ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary)'), 
                                      border: isT ? (isCorrectT ? '1px solid #059669' : '1px solid #dc2626') : (isCorrectT ? '1px dashed rgba(5, 150, 105, 0.45)' : '1px solid var(--border-color)'), 
                                      color: isT ? (isCorrectT ? '#059669' : '#dc2626') : (isCorrectT ? '#059669' : 'var(--text-muted)') 
                                    }}>
                                      {isT ? (isCorrectT ? '✓ True' : '✗ True') : (isCorrectT ? '✓ True' : 'True')}
                                    </div>
                                    {/* False Pill */}
                                    <div style={{ 
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                      minWidth: '66px', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                      background: isF ? (isCorrectF ? 'rgba(5, 150, 105, 0.14)' : 'rgba(220, 38, 38, 0.14)') : (isCorrectF ? 'rgba(5, 150, 105, 0.06)' : 'var(--bg-secondary)'), 
                                      border: isF ? (isCorrectF ? '1px solid #059669' : '1px solid #dc2626') : (isCorrectF ? '1px dashed rgba(5, 150, 105, 0.45)' : '1px solid var(--border-color)'), 
                                      color: isF ? (isCorrectF ? '#059669' : '#dc2626') : (isCorrectF ? '#059669' : 'var(--text-muted)') 
                                    }}>
                                      {isF ? (isCorrectF ? '✓ False' : '✗ False') : (isCorrectF ? '✓ False' : 'False')}
                                    </div>
                                    <div style={{ minWidth: '76px', textAlign: 'right' }}>
                                      {answered && isCorrect && <span className={styles.correctBadge}>✓ Correct</span>}
                                      {answered && !isCorrect && <span className={styles.wrongBadge}>✗ Wrong</span>}
                                      {!answered && <span className={styles.skippedBadge}>— Skipped</span>}
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
                            
                            let optionClass = styles.reviewOption;
                            if (isStudentAnswer && isCorrectAnswer) optionClass += ` ${styles.optionStudentCorrect}`;
                            else if (isWrongAnswer) optionClass += ` ${styles.optionIncorrect}`;
                            else if (isCorrectAnswer) optionClass += ` ${styles.optionCorrect}`;
                            
                            return (
                              <div key={`${question.questionId}-${option.letter}`} className={optionClass}>
                                <span className={styles.optionLetter}>{option.letter}</span>
                                <span className={styles.optionText}>{option.text}</span>
                                {isStudentAnswer && isCorrectAnswer && <span className={styles.correctBadge}>✓ Your Answer (Correct)</span>}
                                {isWrongAnswer && <span className={styles.wrongBadge}>✗ Your Answer</span>}
                                {!isStudentAnswer && isCorrectAnswer && <span className={styles.keyBadge}>✓ Correct Key</span>}
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
                <h2 className={styles.leaderboardTitle}>
                  <Trophy className={styles.leaderboardIcon} />
                  Leaderboard — Top {topLeaderboard.length} Participants
                </h2>
                
                {leaderboard.length === 0 ? (
                  <div className={styles.emptyLeaderboard}>
                    <Trophy className={styles.emptyIcon} />
                    <p>No participant results submitted yet. Be the first to rank!</p>
                  </div>
                ) : (
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
                      {topLeaderboard.map((entry) => {
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
                )}
                
                <p className={styles.leaderboardNote}>
                  Rankings update dynamically as peers submit attempts. {leaderboard.length > 20 ? `Showing top 20 of ${leaderboard.length} total participants.` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}