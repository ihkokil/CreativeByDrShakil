'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronLeft,
  Save,
  Lock,
  RotateCcw,
  Shuffle,
  Check,
  X,
} from 'lucide-react';
import styles from './page.module.css';

interface Question {
  id: string;
  questionText: string;
  questionType: string;
  options: Array<{ letter: string; text: string }>;
  correctOption: string;
  explanation: string | null;
  displayOrder: number;
  optionOrder: number[];
}

interface Answer {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  isLocked: boolean;
  saved: boolean;
}

interface Attempt {
  id: string;
  quizId: string;
  studentId: string;
  startedAt: string;
  durationMinutes: number;
  status: string;
}

export default function QuizTakePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const attemptId = params.attemptId as string;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [tabWarningShown, setTabWarningShown] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  // Load quiz attempt data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}/attempt/${attemptId}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load quiz');
        }
        
        setAttempt(data.attempt);
        setQuestions(data.questions || []);
        
        // Initialize answers
        const initialAnswers: Record<string, Answer> = {};
        data.questions?.forEach((q: Question) => {
          initialAnswers[q.id] = {
            questionId: q.id,
            selectedOption: null,
            isCorrect: null,
            isLocked: false,
            saved: false,
          };
        });
        
        if (data.existingAnswers) {
          data.existingAnswers.forEach((ans: any) => {
            if (initialAnswers[ans.questionId]) {
              initialAnswers[ans.questionId] = {
                ...initialAnswers[ans.questionId],
                selectedOption: ans.selectedOption,
                isCorrect: ans.isCorrect,
                isLocked: false,
                saved: true,
              };
            }
          });
        }
        
        setAnswers(initialAnswers);
        
        // Calculate time remaining
        if (data.attempt.durationMinutes === 0) {
          setTimeRemaining(Infinity);
          startedAtRef.current = new Date(data.attempt.startedAt).getTime();
        } else {
          const startedAtStr = data.attempt.startedAt;
          const startedAt = new Date(
            startedAtStr.endsWith('Z') || startedAtStr.includes('+') 
              ? startedAtStr 
              : startedAtStr + 'Z'
          );
          startedAtRef.current = startedAt.getTime();
          
          if (data.attempt.timeRemaining !== undefined && data.attempt.timeRemaining !== null && data.attempt.timeRemaining > 0) {
            setTimeRemaining(data.attempt.timeRemaining);
          } else {
            const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
            const totalSeconds = data.attempt.durationMinutes * 60;
            const remaining = Math.max(0, totalSeconds - elapsed);
            setTimeRemaining(remaining);
          }
        }
        
        // Check if already submitted
        if (data.attempt.status !== 'in_progress') {
          setShowResults(true);
          if (data.attempt.status === 'auto_submitted') {
            setAutoSubmitted(true);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [quizId, attemptId]);

  // Timer
  useEffect(() => {
    if (showResults || timeRemaining === null || timeRemaining === Infinity || timeRemaining <= 0) return;
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev === Infinity) return prev;
        const newTime = prev - 1;
        if (newTime <= 0) {
          handleAutoSubmit();
          return 0;
        }
        return newTime;
      });
    }, 1000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeRemaining, showResults]);

  // Warn before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!showResults && !autoSubmitted) {
        e.preventDefault();
        e.returnValue = 'You have an active quiz in progress. Leaving will auto-submit your quiz.';
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showResults, autoSubmitted]);

  // Detect tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !showResults && !autoSubmitted) {
        setTabWarningShown(true);
        // Auto-save on tab blur
        saveAnswers();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [showResults, autoSubmitted]);

  // Save answers to server
  const saveAnswers = useCallback(async () => {
    const unsavedAnswers = Object.entries(answers)
      .filter(([_, ans]) => ans.selectedOption && !ans.saved)
      .map(([questionId, ans]) => ({ questionId, selectedOption: ans.selectedOption }));
    
    if (unsavedAnswers.length === 0) return;
    
    try {
      const res = await fetch(`/api/quiz/attempt/${attemptId}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: unsavedAnswers }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const savedIds = new Set(
            (data.results || [])
              .filter((r: any) => r.saved)
              .map((r: any) => r.questionId)
          );
          
          setAnswers(prev => {
            const updated = { ...prev };
            unsavedAnswers.forEach(({ questionId }) => {
              if (updated[questionId] && savedIds.has(questionId)) {
                updated[questionId] = { ...updated[questionId], saved: true };
              }
            });
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Failed to save answers:', err);
    }
  }, [answers, attemptId]);

  // Save a single answer immediately to the server
  const saveAnswerImmediately = useCallback(async (questionId: string, selectedOption: string) => {
    try {
      const res = await fetch(`/api/quiz/attempt/${attemptId}/save-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: [{ questionId, selectedOption }] }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAnswers(prev => {
            if (prev[questionId]) {
              return {
                ...prev,
                [questionId]: { ...prev[questionId], saved: true },
              };
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.error('Failed to save answer immediately:', err);
    }
  }, [attemptId]);

  // Debounced save (backup for any missed immediate saves)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveAnswers, 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [answers, saveAnswers]);

  // Keyboard dismissal for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSubmitConfirm) {
        setShowSubmitConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSubmitConfirm]);

  const handleAnswerSelect = (questionId: string, optionLetter: string, mcqSelection?: 'T' | 'F') => {
    if (showResults) return;
    const q = questions.find(item => item.id === questionId);
    if (!q) return;

    let newSelectedForSave = optionLetter;

    setAnswers(prev => {
      const current = prev[questionId];
      
      if (q.questionType === 'mcq') {
        const optionCount = q.options?.length || 5;
        const idx = optionLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
        const currentStr = current?.selectedOption || '-'.repeat(optionCount);
        const newArr = currentStr.padEnd(optionCount, '-').split('');
        if (idx >= 0 && idx < optionCount) {
          newArr[idx] = mcqSelection || 'T';
        }
        const newSelectedOption = newArr.join('');
        newSelectedForSave = newSelectedOption;

        return {
          ...prev,
          [questionId]: {
            ...current,
            selectedOption: newSelectedOption,
            isLocked: false,
            saved: false,
          },
        };
      } else {
        newSelectedForSave = optionLetter;
        return {
          ...prev,
          [questionId]: {
            ...current,
            selectedOption: optionLetter,
            isLocked: false,
            saved: false,
          },
        };
      }
    });
    
    // Immediately persist to server
    setTimeout(() => {
      saveAnswerImmediately(questionId, newSelectedForSave);
    }, 0);
  };

  const handleAutoSubmit = useCallback(async () => {
    if (showResults) return;
    setSubmitting(true);
    setAutoSubmitted(true);
    
    try {
      await saveAnswers();
      const res = await fetch(`/api/quiz/attempt/${attemptId}/auto-submit`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Auto-submit failed');
      
      setShowResults(true);
      // Update answers with correct/incorrect
      if (data.results) {
        setAnswers(prev => {
          const updated = { ...prev };
          Object.entries(data.results.answers).forEach(([qId, result]: [string, any]) => {
            if (updated[qId]) {
              updated[qId] = {
                ...updated[qId],
                isCorrect: result.isCorrect,
              };
            }
          });
          return updated;
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [showResults, attemptId, saveAnswers]);

  // Auto-submit if time expires while tab was closed or when timer hits zero
  useEffect(() => {
    if (attempt && attempt.status === 'in_progress' && timeRemaining !== null && timeRemaining !== Infinity && timeRemaining <= 0 && !showResults && !loading && !submitting) {
      handleAutoSubmit();
    }
  }, [timeRemaining, attempt, showResults, loading, submitting, handleAutoSubmit]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setShowSubmitConfirm(false);
    
    try {
      await saveAnswers();
      const res = await fetch(`/api/quiz/attempt/${attemptId}/submit`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Submit failed');
      
      setShowResults(true);
      if (data.results) {
        setAnswers(prev => {
          const updated = { ...prev };
          Object.entries(data.results.answers).forEach(([qId, result]: [string, any]) => {
            if (updated[qId]) {
              updated[qId] = { ...updated[qId], isCorrect: result.isCorrect };
            }
          });
          return updated;
        });
      }
      
      const targetUrl = returnUrl
        ? `/dashboard/quizzes/${quizId}/result?attempt=${attemptId}&returnUrl=${encodeURIComponent(returnUrl)}`
        : `/dashboard/quizzes/${quizId}/result?attempt=${attemptId}`;
      router.push(targetUrl);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return '00:00';
    if (seconds === Infinity) return 'Unlimited';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Set active question index on scroll
  useEffect(() => {
    if (questions.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          setCurrentQuestionIndex(index);
        }
      });
    }, observerOptions);

    questions.forEach((q) => {
      const el = document.getElementById(`question-${q.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [questions]);

  const answeredCount = Object.values(answers).filter(a => a.selectedOption).length;
  const totalQuestions = questions.length;
  const unansweredCount = totalQuestions - answeredCount;
  const progressPercent = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const totalDurationSeconds = (attempt?.durationMinutes || 0) * 60;
  const isTimeWarning = timeRemaining !== null && timeRemaining !== Infinity && timeRemaining <= Math.max(60, totalDurationSeconds * 0.1);
  const isTimeCritical = timeRemaining !== null && timeRemaining !== Infinity && timeRemaining <= 30;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !attempt) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle className={styles.errorIcon} />
          <h2>Unable to Load Quiz</h2>
          <p>{error}</p>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Tab Warning Toast */}
      {tabWarningShown && !showResults && (
        <div className={styles.tabWarning} role="alert">
          <AlertCircle className={styles.warningIcon} />
          <span>Your answers are automatically saved. Please keep this tab active to track your timer accurately.</span>
          <button onClick={() => setTabWarningShown(false)} className={styles.warningClose} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Top Navigation Bar with Progress Bar */}
      {!showResults && (
        <header className={styles.topBar}>
          <div className={styles.topBarProgress} title={`${answeredCount} of ${totalQuestions} answered`}>
            <span>{answeredCount}/{totalQuestions} Answered</span>
            <div className={styles.progressBarTrack} role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={totalQuestions}>
              <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className={styles.topBarDivider} />

          <div className={`${styles.topBarTimer} ${isTimeCritical ? styles.timerCritical : isTimeWarning ? styles.timerWarning : ''}`}>
            <Clock className={styles.topBarTimerIcon} />
            <span>{formatTime(timeRemaining)}</span>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className={styles.topBarSubmitBtn}
          >
            <Check size={16} />
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </header>
      )}

      <main className={styles.mainContent}>
        {/* Question Content */}
        <section className={styles.questionContent} aria-label="Quiz questions">
          {questions.map((q, index) => {
            const isCurrent = index === currentQuestionIndex;
            const isAnswered = !!answers[q.id]?.selectedOption;
            const isSba = q.questionType !== 'mcq';
            return (
              <article
                key={q.id}
                id={`question-${q.id}`}
                className={`${styles.questionCard} ${isCurrent ? styles.questionCurrent : ''} ${isAnswered ? styles.questionAnswered : styles.questionUnanswered}`}
                data-index={index}
              >
                <div className={styles.questionHeader}>
                  <h2 className={styles.questionTitle}>
                    <span className={styles.questionNumber}>Q{index + 1}</span>
                    {q.questionText}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span className={`${styles.typeBadge} ${isSba ? styles.typeBadgeSba : styles.typeBadgeTf}`}>
                      {isSba ? 'Single Best Answer' : 'True / False'}
                    </span>
                  </div>
                </div>

                <div className={styles.optionsGrid} role={isSba ? "radiogroup" : "group"} aria-label={`Options for question ${index + 1}`}>
                  {q.questionType === 'mcq' ? (
                    q.options.map((option, idx) => {
                      const answer = answers[q.id];
                      const currentStr = answer?.selectedOption || '-'.repeat(q.options.length || 5);
                      const originalIdx = option.letter.charCodeAt(0) - 65;
                      const isT = currentStr[originalIdx] === 'T';
                      const isF = currentStr[originalIdx] === 'F';
                      
                      const correctStr = q.correctOption || 'F'.repeat(q.options.length || 5);
                      const isCorrectT = correctStr[originalIdx] === 'T';
                      const isCorrectF = correctStr[originalIdx] === 'F';
                      
                      let optionClass = styles.mcqMatrixRow;
                      if (showResults) {
                        if ((isT && isCorrectT) || (isF && isCorrectF)) {
                           optionClass += ` ${styles.optionCorrect}`;
                        } else if (isT || isF) {
                           optionClass += ` ${styles.optionIncorrect}`;
                        }
                      }
                      
                      return (
                        <div key={`${q.id}-${option.letter}`} className={optionClass}>
                          <div className={styles.mcqMatrixLabel}>
                            <span className={styles.optionLetter}>{option.letter}</span>
                            <span className={styles.optionText}>{option.text}</span>
                          </div>

                          <div className={styles.mcqMatrixButtons}>
                            <button
                              type="button"
                              onClick={() => handleAnswerSelect(q.id, option.letter, 'T')}
                              disabled={showResults}
                              className={`${styles.mcqBtn} ${styles.trueBtn} ${isT ? styles.mcqBtnSelected : ''} ${showResults && isCorrectT ? styles.mcqBtnCorrect : ''} ${showResults && isT && !isCorrectT ? styles.mcqBtnWrong : ''}`}
                              aria-pressed={isT}
                              aria-label={`Mark option ${option.letter} as True`}
                            >
                              True
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAnswerSelect(q.id, option.letter, 'F')}
                              disabled={showResults}
                              className={`${styles.mcqBtn} ${styles.falseBtn} ${isF ? styles.mcqBtnSelected : ''} ${showResults && isCorrectF ? styles.mcqBtnCorrect : ''} ${showResults && isF && !isCorrectF ? styles.mcqBtnWrong : ''}`}
                              aria-pressed={isF}
                              aria-label={`Mark option ${option.letter} as False`}
                            >
                              False
                            </button>
                          </div>
                          
                          {showResults && (
                             <span className={styles.mcqMatrixResult}>
                               {((isT && isCorrectT) || (isF && isCorrectF)) ? <CheckCircle className={styles.resultIcon} /> : ((isT || isF) ? <XCircle className={styles.resultIcon} /> : null)}
                             </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    q.options.map((option) => {
                      const answer = answers[q.id];
                      const isSelected = answer?.selectedOption === option.letter;
                      
                      let optionClass = styles.optionCard;
                      if (isSelected && !showResults) optionClass += ` ${styles.optionSelected}`;
                      
                      if (showResults) {
                        if (option.letter === q.correctOption) {
                          optionClass += ` ${styles.optionCorrect}`;
                        } else if (isSelected) {
                          optionClass += ` ${styles.optionIncorrect}`;
                        }
                      }
                      
                      return (
                        <button
                          key={`${q.id}-${option.letter}`}
                          type="button"
                          onClick={() => handleAnswerSelect(q.id, option.letter)}
                          disabled={showResults}
                          className={optionClass}
                          role="radio"
                          aria-checked={isSelected}
                          aria-disabled={showResults}
                        >
                          <span className={styles.optionLetter}>{option.letter}</span>
                          <span className={styles.optionText}>{option.text}</span>
                          
                          {isSelected && !showResults && (
                            <span className={styles.optionCheck}>
                              <CheckCircle className={styles.checkIcon} />
                            </span>
                          )}
                          
                          {showResults && option.letter === q.correctOption && (
                            <span className={styles.optionResultIcon}>
                              <CheckCircle className={styles.resultIcon} />
                            </span>
                          )}
                          
                          {showResults && isSelected && option.letter !== q.correctOption && (
                            <span className={styles.optionResultIconError}>
                              <XCircle className={styles.resultIcon} />
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {showResults && answers[q.id] && q.explanation && (
                  <div className={styles.explanation}>
                    <HelpCircle className={styles.explanationIcon} />
                    <div>
                      <strong>Explanation:</strong>
                      <p>{q.explanation}</p>
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          <div className={styles.bottomSpacer}></div>

          {/* Submit Confirmation Modal */}
          {showSubmitConfirm && (
            <div className={styles.modalOverlay} onClick={() => setShowSubmitConfirm(false)}>
              <div 
                className={styles.modal} 
                role="dialog"
                aria-modal="true"
                aria-labelledby="submit-modal-title"
                onClick={e => e.stopPropagation()}
              >
                <h3 id="submit-modal-title">Submit Quiz?</h3>
                <p>
                  You have answered <strong>{answeredCount}</strong> out of <strong>{totalQuestions}</strong> questions.
                  {unansweredCount > 0 && (
                    <span className={styles.unansweredWarning}>
                      {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''} will be marked as skipped.
                    </span>
                  )}
                  <br />
                  <strong>This action cannot be undone.</strong>
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirm(false)}
                    className={styles.modalCancel}
                  >
                    Continue Quiz
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={styles.modalConfirm}
                  >
                    {submitting ? 'Submitting...' : 'Yes, Submit Quiz'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-submit notification */}
          {autoSubmitted && showResults && (
            <div className={styles.autoSubmitNotice} role="alert">
              <AlertCircle className={styles.noticeIcon} />
              <p>Time expired. Quiz has been auto-submitted.</p>
              <Link href={`/dashboard/quizzes/${quizId}/result?attempt=${attemptId}`} className={styles.viewResultsBtn}>
                View Results
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}