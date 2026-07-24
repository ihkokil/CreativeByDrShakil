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
  const attemptId = searchParams.get('attempt') || '';
  const isAutoSubmitted = searchParams.get('auto') === 'true';
  
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
      
      router.push(`/dashboard/quizzes/${quizId}/attempt/${resData.attemptId}`);
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
            router.push('/dashboard/quizzes');
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-error';
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
      alert('Failed to generate PDF. Please try again.');
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

  const { attempt, quiz, questionsReview, leaderboard } = data;
  const actualCorrectCount = questionsReview.filter(q => q.isCorrect).length;
  const actualPartialCount = questionsReview.filter(q => q.isPartial).length;
  const actualSkippedCount = questionsReview.filter(q => q.isSkipped).length;
  const actualWrongCount = questionsReview.filter(q => !q.isCorrect && !q.isPartial && !q.isSkipped).length;
  const totalQs = questionsReview.length || 1;
  const grossScore = attempt.netScore + attempt.negativeMarks;
  const partialMarksEarned = Math.max(0, grossScore - (actualCorrectCount * quiz.marksPerCorrect));

  return (
    <div className={styles.container}>
      <div id="quiz-result-content">
        <header className={styles.header}>
        <Link href="/dashboard/quizzes" className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          Back to Quizzes
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
                >
                  <div className={styles.scoreInner}>
                    <span className={`${styles.scoreValue} ${getScoreColor(attempt.percentageScore)}`}>
                      {attempt.percentageScore.toFixed(1)}%
                    </span>
                    <span className={styles.scoreLabel}>Overall Score</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.scoreDetails}>
              <div className={styles.detailRow}>
                <div className={styles.detailItem}>
                  <div className={`${styles.detailValue} text-success`}>{actualCorrectCount}</div>
                  <div className={styles.detailLabel}>Correct</div>
                </div>
                {actualPartialCount > 0 && (
                  <>
                    <div className={styles.detailDivider} />
                    <div className={styles.detailItem}>
                      <div className={`${styles.detailValue} text-info`} style={{ color: 'var(--info-color)' }}>{actualPartialCount}</div>
                      <div className={styles.detailLabel}>Partial</div>
                    </div>
                  </>
                )}
                <div className={styles.detailDivider} />
                <div className={styles.detailItem}>
                  <div className={`${styles.detailValue} text-error`} style={{ color: 'var(--error-color)' }}>{actualWrongCount}</div>
                  <div className={styles.detailLabel}>Wrong</div>
                </div>
                <div className={styles.detailDivider} />
                <div className={styles.detailItem}>
                  <div className={`${styles.detailValue} text-muted`}>{actualSkippedCount}</div>
                  <div className={styles.detailLabel}>Skipped</div>
                </div>
              </div>
              
              {quiz.allowNegativeMarking && attempt.negativeMarks > 0 && (
                <div className={styles.negativeMarks}>
                  <XCircle className={styles.negativeIcon} />
                  <span>Negative marks: <strong>{attempt.negativeMarks.toFixed(2)}</strong> ({(quiz.negativeValue <= 1 && quiz.negativeValue > 0 ? quiz.negativeValue * 100 : quiz.negativeValue).toFixed(0)}% per wrong answer)</span>
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
            onClick={() => setActiveTab('summary')}
            className={`${styles.tabBtn} ${activeTab === 'summary' ? styles.tabActive : ''}`}
          >
            <BarChart2 className={styles.tabIcon} />
            Summary & Review
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'leaderboard'}
            onClick={() => setActiveTab('leaderboard')}
            className={`${styles.tabBtn} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
          >
            <Trophy className={styles.tabIcon} />
            Leaderboard
          </button>
        </nav>

        {/* Tab Panels */}
        <div className={styles.tabContent}>
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className={styles.tabPanel} role="tabpanel">
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <TrendingUp className={styles.cardIcon} />
                    Score Breakdown
                  </h3>
                  <div className={styles.breakdown}>
                    <div className={styles.breakdownItem}>
                      <span className={styles.breakdownLabel}>Correct Answers</span>
                      <span className={`${styles.breakdownValue} text-success`}>
                        {actualCorrectCount} × {quiz.marksPerCorrect} = {actualCorrectCount * quiz.marksPerCorrect}
                      </span>
                    </div>
                    {actualPartialCount > 0 && (
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Partial Marks</span>
                        <span className={`${styles.breakdownValue} text-info`} style={{ color: 'var(--info-color)' }}>
                          +{partialMarksEarned.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {quiz.allowNegativeMarking && actualWrongCount > 0 && (
                      <div className={styles.breakdownItem}>
                        <span className={styles.breakdownLabel}>Wrong Answers Penalty</span>
                        <span className={`${styles.breakdownValue} text-error`}>
                          -{attempt.negativeMarks.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className={styles.breakdownTotal}>
                      <span>Net Score</span>
                      <span className={getScoreColor(attempt.netScore)}>{attempt.netScore.toFixed(2)}</span>
                    </div>
                    <div className={styles.breakdownTotal}>
                      <span>Percentage</span>
                      <span className={getScoreColor(attempt.percentageScore)}>{attempt.percentageScore.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <Clock className={styles.cardIcon} />
                    Time Analysis
                  </h3>
                  <div className={styles.timeAnalysis}>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Time Taken</span>
                      <span className={styles.timeValue}>{formatTime(attempt.timeTakenSeconds)}</span>
                    </div>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Time Limit</span>
                      <span className={styles.timeValue}>{quiz.durationMinutes ? `${quiz.durationMinutes}m` : 'No Limit'}</span>
                    </div>
                    <div className={styles.timeItem}>
                      <span className={styles.timeLabel}>Efficiency</span>
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
                    Rank & Position
                  </h3>
                  <div className={styles.rankInfo}>
                    <div className={styles.rankMain}>
                      <span className={styles.rankLabel}>Your Rank</span>
                      <span className={styles.rankValue}>#{attempt.rank || 'N/A'}</span>
                    </div>
                    <div className={styles.rankLabel}>out of {leaderboard.length} participant{leaderboard.length !== 1 ? 's' : ''}</div>
                    <div className={styles.rankMethod}>
                      Ranking: {attempt.attemptNumber === 1 ? 'First Attempt' : 'Best Attempt'} • Tie-breaker: Less time taken
                    </div>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <h3 className={styles.cardTitle}>
                    <Target className={styles.cardIcon} />
                    Accuracy Analysis
                  </h3>
                  <div className={styles.pieChartContainer}>
                    <div className={styles.pieChartWrapper}>
                      <div 
                        className={styles.pieChart}
                        style={{
                          background: `conic-gradient(var(--success-color) 0% ${actualCorrectCount / totalQs * 100}%, var(--info-color) ${actualCorrectCount / totalQs * 100}% ${(actualCorrectCount + actualPartialCount) / totalQs * 100}%, var(--error-color) ${(actualCorrectCount + actualPartialCount) / totalQs * 100}% ${(actualCorrectCount + actualPartialCount + actualWrongCount) / totalQs * 100}%, var(--warning-color) ${(actualCorrectCount + actualPartialCount + actualWrongCount) / totalQs * 100}% 100%)`
                        }}
                      ></div>
                    </div>
                    <div className={styles.pieChartLegend}>
                      <div className={styles.legendRow}>
                        <div className={styles.legendDot} style={{ background: 'var(--success-color)' }}></div>
                        <span className={styles.legendLabel}>Correct</span>
                        <span className={styles.legendValue}>{actualCorrectCount}</span>
                      </div>
                      {actualPartialCount > 0 && (
                        <div className={styles.legendRow}>
                          <div className={styles.legendDot} style={{ background: 'var(--info-color)' }}></div>
                          <span className={styles.legendLabel}>Partial</span>
                          <span className={styles.legendValue}>{actualPartialCount}</span>
                        </div>
                      )}
                      <div className={styles.legendRow}>
                        <div className={styles.legendDot} style={{ background: 'var(--error-color)' }}></div>
                        <span className={styles.legendLabel}>Wrong</span>
                        <span className={styles.legendValue}>{actualWrongCount}</span>
                      </div>
                      <div className={styles.legendRow}>
                        <div className={styles.legendDot} style={{ background: 'var(--warning-color)' }}></div>
                        <span className={styles.legendLabel}>Skipped</span>
                        <span className={styles.legendValue}>{actualSkippedCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.actions}>
                <Link href="/dashboard/quizzes" className={styles.secondaryBtn}>
                  <ChevronLeft className={styles.btnIcon} />
                  Back to Quizzes
                </Link>
                {quiz.allowMultipleAttempts && (!quiz.maxAttempts || attempt.attemptNumber < quiz.maxAttempts) && (
                  <button onClick={handleRetakeQuiz} disabled={retaking} className={styles.retakeBtn}>
                    <RotateCcw className={styles.btnIcon} />
                    {retaking ? 'Starting...' : 'Retake Quiz'}
                  </button>
                )}
                <button onClick={handleDownloadPDF} disabled={downloading} className={styles.downloadBtn}>
                  <Download className={styles.btnIcon} />
                  {downloading ? 'Generating...' : 'Download Result (PDF)'}
                </button>
              </div>
              {/* Answer Review Section */}
              <div id="answer-review-section" className={styles.reviewSectionWrapper} style={{ marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '32px', background: 'var(--bg-primary)' }}>
                <div id="review-header-section" className={styles.reviewHeader}>
                  <h2 className={styles.reviewTitle}>Answer Review</h2>
                  <div className={styles.reviewStats}>
                    <span className={`${styles.reviewStat} text-success`}>
                      <CheckCircle className={styles.reviewIcon} /> {questionsReview.filter(q => q.isCorrect).length} Correct
                    </span>
                    {questionsReview.some(q => q.isPartial) && (
                      <span className={`${styles.reviewStat} text-info`} style={{ color: 'var(--info-color)', background: 'var(--info-light)' }}>
                        <CheckCircle className={styles.reviewIcon} /> {questionsReview.filter(q => q.isPartial).length} Partial
                      </span>
                    )}
                    <span className={`${styles.reviewStat} text-error`}>
                      <XCircle className={styles.reviewIcon} /> {questionsReview.filter(q => !q.isCorrect && !q.isPartial && !q.isSkipped).length} Wrong
                    </span>
                    <span className={`${styles.reviewStat} text-warning`}>
                      <HelpCircle className={styles.reviewIcon} /> {questionsReview.filter(q => q.isSkipped).length} Skipped
                    </span>
                  </div>
                </div>
                
                <div className={styles.reviewList}>
                  {questionsReview.map((question, index) => (
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
                          question.options.map((option, idx) => {
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
                                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isT ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: isT ? 'white' : 'var(--text-muted)' }}>
                                     <Check size={18} />
                                   </div>
                                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: isF ? 'var(--primary-color)' : 'var(--bg-tertiary)', color: isF ? 'white' : 'var(--text-muted)' }}>
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
                          question.options.map(option => {
                            const isStudentAnswer = option.letter === question.studentAnswer;
                            const isCorrectAnswer = option.letter === question.correctOption;
                            const isWrongAnswer = isStudentAnswer && !isCorrectAnswer;
                            
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

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className={styles.tabPanel} role="tabpanel">
              <div className={styles.leaderboardContainer}>
                <h2 className={styles.leaderboardTitle}>
                  <Trophy className={styles.leaderboardIcon} />
                  Leaderboard - Top {Math.min(20, leaderboard.length)} Participants
                </h2>
                
                {leaderboard.length === 0 ? (
                  <div className={styles.emptyLeaderboard}>
                    <Trophy className={styles.emptyIcon} />
                    <p>No other participants yet. Be the first!</p>
                  </div>
                ) : (
                  <table className={styles.leaderboardTable} role="table">
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Student</th>
                        <th scope="col">Score</th>
                        <th scope="col">Time</th>
                        <th scope="col">Attempt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => (
                        <tr key={`${entry.rank}-${entry.studentName}`} className={entry.isCurrentUser ? styles.currentUser : ''}>
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
                            <span className={getScoreColor(entry.netScore)}>
                              {entry.netScore.toFixed(1)}%
                            </span>
                          </td>
                          <td className={styles.timeCell}>
                            {entry.timeTakenSeconds ? formatTime(entry.timeTakenSeconds) : 'N/A'}
                          </td>
                          <td className={styles.attemptCell}>
                            #{entry.attemptNumber || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                
                {leaderboard.length > 20 && (
                  <p className={styles.leaderboardNote}>
                    Showing top 20 of {leaderboard.length} participants
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}