'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  ChevronLeft,
  Download,
  BarChart2,
  Award,
  User,
  Users,
  Target,
  TrendingUp,
  RotateCcw,
  Search,
  ChevronRight,
  Sparkles,
  X,
  Check,
  HelpCircle,
  ExternalLink,
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
  
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [retaking, setRetaking] = useState(false);

  // Leaderboard Search
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

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

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -24;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
      window.history.pushState(null, '', `#${sectionId}`);
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
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

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

      // 1. Capture Review Header (Quiz Title, Attempt, Score, Accuracy, and Stats)
      const reviewHeader = document.getElementById('review-header-section');
      if (reviewHeader) await addElementToPdf(reviewHeader);
      
      // 2. Capture Each Question Card Individually
      const questionCards = Array.from(document.querySelectorAll('.pdf-question-card')) as HTMLElement[];
      for (const card of questionCards) {
        await addElementToPdf(card);
      }
      
      pdf.save(`${data.quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_result.pdf`);
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

  // Leaderboard Windowing Calculations: Always display 10 ranks around the student (5 before, student, 4 after)
  const userRankIndex = leaderboard.findIndex(e => e.isCurrentUser);
  const currentUserEntry = userRankIndex >= 0 ? leaderboard[userRankIndex] : null;

  const isSearching = leaderboardSearch.trim() !== '';
  const searchFilteredList = isSearching
    ? leaderboard.filter(e => e.studentName.toLowerCase().includes(leaderboardSearch.toLowerCase().trim()))
    : leaderboard;

  const TARGET_WINDOW = 10;
  let windowStart = 0;
  let windowEnd = leaderboard.length;

  if (leaderboard.length > TARGET_WINDOW) {
    if (userRankIndex >= 0) {
      // 5 before, the student themselves, and 4 after (total = 10)
      windowStart = userRankIndex - 5;
      windowEnd = windowStart + TARGET_WINDOW;

      if (windowStart < 0) {
        // Workaround for rank 1, 2, etc. (where 5 before is not possible: clamp to start)
        windowStart = 0;
        windowEnd = TARGET_WINDOW;
      } else if (windowEnd > leaderboard.length) {
        // Workaround when student is near the end: clamp to end
        windowEnd = leaderboard.length;
        windowStart = Math.max(0, windowEnd - TARGET_WINDOW);
      }
    } else {
      // Fallback if student not in leaderboard
      windowStart = 0;
      windowEnd = TARGET_WINDOW;
    }
  }

  const displayedLeaderboard = isSearching 
    ? searchFilteredList 
    : leaderboard.slice(windowStart, windowEnd);

  const viewTitleNote = isSearching
    ? `Showing ${displayedLeaderboard.length} of ${leaderboard.length} participants matching "${leaderboardSearch.trim()}"`
    : `Showing ${displayedLeaderboard.length} participants around your rank (Rank #${currentUserEntry?.rank || attempt.rank || '—'} of ${leaderboard.length})`;

  return (
    <div className={styles.container}>
      <div id="quiz-result-content">
        <header className={styles.header}>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backLink}>
            <ChevronLeft className={styles.backIcon} />
            {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
          </Link>
        </header>

        {/* ─── SECTION 1: Performance Overview & Scorecard ─── */}
        <section id="score-section" className={`${styles.sectionCard} ${styles.sectionCardOverview}`}>
          <div className={styles.sectionCardHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={`${styles.sectionIconBadge} ${styles.sectionIconBadgeScore}`}>
                <Award size={20} />
              </div>
              <div>
                <span className={`${styles.sectionPreTitle} ${styles.preTitleScore}`}>Section 1 of 3 • Scorecard</span>
                <h2 className={styles.sectionCardTitle}>Performance Overview</h2>
                <p className={styles.sectionCardSubtitle}>
                  Attempt #{attempt.attemptNumber} summary, score analytics, and efficiency breakdown
                </p>
              </div>
            </div>
            <div className={styles.sectionHeaderRight}>
              <span className={styles.scorePill}>
                <Target size={14} />
                {percentageScore.toFixed(1)}% Accuracy
              </span>
            </div>
          </div>
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
                        <span className={styles.breakdownLabel}>Negative Marks</span>
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
                <a 
                  href="#leaderboard-section" 
                  onClick={(e) => scrollToSection(e, 'leaderboard-section')} 
                  className={styles.secondaryBtn}
                >
                  <Trophy className={styles.btnIcon} />
                  Leaderboard
                </a>
                <a 
                  href="#answer-review-section" 
                  onClick={(e) => scrollToSection(e, 'answer-review-section')} 
                  className={styles.secondaryBtn}
                >
                  <HelpCircle className={styles.btnIcon} />
                  Review Answers
                </a>
                <button type="button" onClick={handleDownloadPDF} disabled={downloading} className={styles.downloadBtn}>
                  <Download className={styles.btnIcon} />
                  {downloading ? 'Generating...' : 'Download Result (PDF)'}
                </button>
              </div>
        </section>

        {/* ─── SECTION 2: Live Leaderboard & Standings ─── */}
        <section id="leaderboard-section" className={`${styles.sectionCard} ${styles.sectionCardLeaderboard}`}>
          <div className={styles.sectionCardHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={`${styles.sectionIconBadge} ${styles.sectionIconBadgeLeaderboard}`}>
                <Trophy size={20} />
              </div>
              <div>
                <span className={`${styles.sectionPreTitle} ${styles.preTitleLeaderboard}`}>Section 2 of 3 • Rankings</span>
                <h2 className={styles.sectionCardTitle}>Leaderboard & Peer Standings</h2>
                <p className={styles.sectionCardSubtitle}>
                  Live rankings for {quiz.title} • Updated in real-time
                </p>
              </div>
            </div>
            <div className={styles.sectionHeaderRight}>
              <div className={styles.liveIndicatorBadge}>
                <span className={styles.livePulseDot}></span> Live Standings
              </div>
              <Link
                href={`/dashboard/quizzes/${quizId}/leaderboard?scrollToRank=true${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className={styles.fullLeaderboardHeaderBtn}
                title="Show full leaderboard with infinite scrolling"
              >
                <Trophy size={14} />
                <span>Full Leaderboard</span>
                <ExternalLink size={13} />
              </Link>
            </div>
          </div>

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
                          Score: <strong>{currentUserEntry.netScore.toFixed(1)}{totalMarks > 0 ? ` / ${totalMarks.toFixed(1)}` : ' Marks'}</strong> • Time: <strong>{currentUserEntry.timeTakenSeconds ? formatTime(currentUserEntry.timeTakenSeconds) : '—'}</strong> • Attempt: <strong>#{currentUserEntry.attemptNumber || 1}</strong>
                        </span>
                      </div>
                    </div>
                    <div className={styles.standingRight}>
                      <div className={styles.standingRankPill}>
                        <Target size={14} />
                        <span>Rank #{currentUserEntry.rank} of {leaderboard.length}</span>
                      </div>
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
                                    {entry.netScore.toFixed(1)}{totalMarks > 0 ? ` / ${totalMarks.toFixed(1)}` : ' Marks'}
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
                                  {entry.netScore.toFixed(1)}{totalMarks > 0 ? ` / ${totalMarks.toFixed(1)}` : ' Marks'}
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

                    {/* Dedicated Action to View Entire Leaderboard Page (only shown if leaderboard has more participants than displayed) */}
                    {leaderboard.length > displayedLeaderboard.length && (
                      <div className={styles.entireLeaderboardActions}>
                        <Link
                          href={`/dashboard/quizzes/${quizId}/leaderboard?scrollToRank=true${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                          className={styles.openDedicatedPageBtn}
                        >
                          <Trophy size={16} />
                          <span>View All {leaderboard.length} Participants on Full Leaderboard</span>
                          <ExternalLink size={15} />
                        </Link>
                      </div>
                    )}
                  </>
                )}
                
                <p className={styles.leaderboardNote}>
                  Rankings update in real-time as peers complete attempts. {leaderboard.length > 0 ? `Total participants: ${leaderboard.length}` : ''}
                </p>
              </div>
        </section>

        {/* ─── SECTION 3: Answer Review & Explanations ─── */}
        <section id="answer-review-section" className={`${styles.sectionCard} ${styles.sectionCardReview}`}>
          <div id="review-header-section" className={styles.sectionCardHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={`${styles.sectionIconBadge} ${styles.sectionIconBadgeReview}`}>
                <CheckCircle size={20} />
              </div>
              <div>
                <span className={`${styles.sectionPreTitle} ${styles.preTitleReview}`}>Answer Review & Explanations</span>
                <h2 className={styles.sectionCardTitle}>{quiz.title}</h2>
                <p className={styles.sectionCardSubtitle}>
                  Attempt #{attempt.attemptNumber} • Score: {Number(attempt.netScore || 0).toFixed(1)} / {totalMarks.toFixed(1)} Marks ({percentageScore.toFixed(1)}% Accuracy)
                </p>
              </div>
            </div>
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
                          question.options.map((option, idx) => {
                             const studentStr = question.studentAnswer || '-'.repeat(question.options.length || 5);
                             const correctStr = question.correctOption || 'F'.repeat(question.options.length || 5);
                             const originalIdx = option.letter.charCodeAt(0) - 65;
                             const isT = studentStr[originalIdx] === 'T';
                             const isF = studentStr[originalIdx] === 'F';
                             const isCorrectT = correctStr[originalIdx] === 'T';
                             const isCorrectF = correctStr[originalIdx] === 'F';
                             const answered = isT || isF;
                             const isCorrect = (isT && isCorrectT) || (isF && isCorrectF);
                             const displayLetter = String.fromCharCode(65 + idx);
                             
                             let rowStatusClass = styles.tfCompactSkipped;
                             if (answered) {
                               rowStatusClass = isCorrect ? styles.tfCompactCorrect : styles.tfCompactIncorrect;
                             }
                             
                             return (
                                <div key={`${question.questionId}-${option.letter}`} className={`${styles.tfCompactRow} ${rowStatusClass}`}>
                                  {/* Left: Letter Badge + Statement Text */}
                                  <div className={styles.tfCompactLeft}>
                                    <span className={styles.optionLetter}>{displayLetter}</span>
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
                          question.options.map((option, optIdx) => {
                            const displayLetter = String.fromCharCode(65 + optIdx);
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
                                  <span className={styles.optionLetter}>{displayLetter}</span>
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

            {/* Bottom Actions repeated for convenient navigation */}
            <div className={styles.actions} style={{ marginTop: '36px' }}>
              <Link href={returnUrl || "/dashboard/quizzes"} className={styles.secondaryBtn}>
                <ChevronLeft className={styles.btnIcon} />
                {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
              </Link>
              <a 
                href="#score-section" 
                onClick={(e) => scrollToSection(e, 'score-section')} 
                className={styles.secondaryBtn}
              >
                <Award className={styles.btnIcon} />
                Back to Scorecard
              </a>
              <a 
                href="#leaderboard-section" 
                onClick={(e) => scrollToSection(e, 'leaderboard-section')} 
                className={styles.secondaryBtn}
              >
                <Trophy className={styles.btnIcon} />
                Back to Leaderboard
              </a>
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
        </section>
      </div>
    </div>
  );
}