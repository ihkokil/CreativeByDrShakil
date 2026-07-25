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
        const res = await fetch(`/api/quiz/${quizId}/attempt/${attemptId}`);
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
              // For MCQ, isLocked stays false (per-option locking via T/F/- string)
              // For SBA/true_false, isLocked = true if answered
              const question = (data.questions || []).find((q: any) => q.id === ans.questionId);
              const isMcq = question?.questionType === 'mcq';
              
              initialAnswers[ans.questionId] = {
                ...initialAnswers[ans.questionId],
                selectedOption: ans.selectedOption,
                isCorrect: ans.isCorrect,
                isLocked: isMcq ? false : !!ans.selectedOption,
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

  const handleAnswerSelect = (questionId: string, optionLetter: string, mcqSelection?: 'T' | 'F') => {
    const q = questions.find(q => q.id === questionId);
    if (!q) return;

    let newSelectedForSave = optionLetter;

    setAnswers(prev => {
      const current = prev[questionId];
      
      if (q.questionType === 'mcq') {
        const idx = optionLetter.charCodeAt(0) - 65; // A=0, B=1, etc.
        const currentStr = current?.selectedOption || '-'.repeat(q.options.length);
        
        // Per-option lock: if this option is already marked (T or F), don't allow change
        if (currentStr[idx] !== '-') return prev;
        
        const newArr = currentStr.split('');
        newArr[idx] = mcqSelection || 'T';
        const newSelectedOption = newArr.join('');
        newSelectedForSave = newSelectedOption;

        return {
          ...prev,
          [questionId]: {
            ...current,
            selectedOption: newSelectedOption,
            isLocked: false, // MCQ uses per-option locking, not whole-question
            saved: false,
          },
        };
      } else {
        // SBA / true_false: lock entire question on first selection
        if (current?.isLocked) return prev;
        
        newSelectedForSave = optionLetter;
        return {
          ...prev,
          [questionId]: {
            ...current,
            selectedOption: optionLetter,
            isLocked: true,
            saved: false,
          },
        };
      }
    });
    
    // Immediately persist to server
    // Need to compute the value outside setState since setState is async
    setTimeout(() => {
      const currentAnswer = answers[questionId];
      if (q.questionType === 'mcq') {
        const idx = optionLetter.charCodeAt(0) - 65;
        const currentStr = currentAnswer?.selectedOption || '-'.repeat(q.options.length);
        if (currentStr[idx] !== '-') return; // already locked, don't save again
        const newArr = currentStr.split('');
        newArr[idx] = mcqSelection || 'T';
        saveAnswerImmediately(questionId, newArr.join(''));
      } else {
        if (currentAnswer?.isLocked) return;
        saveAnswerImmediately(questionId, optionLetter);
      }
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
      
      router.push(`/dashboard/quizzes/${quizId}/result?attempt=${attemptId}`);
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
          <Link href="/dashboard/quizzes" className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Tab Warning Toast */}
      {tabWarningShown && !showResults && (
        <div className={styles.tabWarning}>
          <AlertCircle className={styles.warningIcon} />
          <span>Don't close this tab! Your quiz will be auto-submitted.</span>
          <button onClick={() => setTabWarningShown(false)} className={styles.warningClose}>&times;</button>
        </div>
      )}

      {/* Top Navigation Bar (replaces floating dock) */}
      {!showResults && (
        <header className={styles.topBar}>
          <div className={styles.topBarProgress}>
            <CheckCircle className={styles.topBarProgressIcon} />
            <span>{answeredCount}/{totalQuestions}</span>
          </div>

          <div className={styles.topBarDivider} />

          <div className={`${styles.topBarTimer} ${timeRemaining !== null && timeRemaining <= 300 && timeRemaining !== Infinity ? styles.timerWarning : ''}`}>
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
                    <span className={styles.lockedBadge} style={{ 
                      background: q.questionType === 'mcq' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                      color: q.questionType === 'mcq' ? '#0ea5e9' : '#a855f7',
                    }}>
                      {q.questionType === 'mcq' ? '✓✗ True / False' : '○ Single Best Answer'}
                    </span>
                    {q.questionType !== 'mcq' && answers[q.id]?.isLocked && (
                      <span className={styles.lockedBadge}>
                        <Lock className={styles.lockedIcon} /> Locked
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.optionsGrid} role="radiogroup" aria-label={`Options for question ${index + 1}`}>
                  {q.questionType === 'mcq' ? (
                    q.options.map((option, idx) => {
                      const answer = answers[q.id];
                      const currentStr = answer?.selectedOption || '-'.repeat(q.options.length);
                      const originalIdx = option.letter.charCodeAt(0) - 65;
                      const isT = currentStr[originalIdx] === 'T';
                      const isF = currentStr[originalIdx] === 'F';
                      const isOptionLocked = currentStr[originalIdx] !== '-'; // per-option lock
                      
                      const correctStr = q.correctOption || 'F'.repeat(q.options.length);
                      const isCorrectT = correctStr[originalIdx] === 'T';
                      const isCorrectF = correctStr[originalIdx] === 'F';
                      
                      let optionClass = styles.mcqMatrixRow;
                      if (isOptionLocked && !showResults) {
                        optionClass += ` ${styles.optionLocked}`;
                      }
                      if (showResults) {
                        if ((isT && isCorrectT) || (isF && isCorrectF)) {
                           optionClass += ` ${styles.optionCorrect}`;
                        } else if (isT || isF) {
                           optionClass += ` ${styles.optionIncorrect}`;
                        }
                      }
                      
                      return (
                        <div key={`${q.id}-${option.letter}`} className={optionClass}>
                          <div className={styles.mcqMatrixButtons}>
                            <button
                              onClick={() => !isOptionLocked && handleAnswerSelect(q.id, option.letter, 'T')}
                              disabled={isOptionLocked || showResults}
                              className={`${styles.mcqBtn} ${isT ? styles.mcqBtnSelected : ''} ${showResults && isCorrectT ? styles.mcqBtnCorrect : ''} ${showResults && isT && !isCorrectT ? styles.mcqBtnWrong : ''}`}
                              title="True"
                            ><Check size={18} /></button>
                            <button
                              onClick={() => !isOptionLocked && handleAnswerSelect(q.id, option.letter, 'F')}
                              disabled={isOptionLocked || showResults}
                              className={`${styles.mcqBtn} ${isF ? styles.mcqBtnSelected : ''} ${showResults && isCorrectF ? styles.mcqBtnCorrect : ''} ${showResults && isF && !isCorrectF ? styles.mcqBtnWrong : ''}`}
                              title="False"
                            ><X size={18} /></button>
                          </div>
                          
                          <div className={styles.mcqMatrixLabel}>
                            <span className={styles.optionLetter}>{option.letter}</span>
                            <span className={styles.optionText}>{option.text}</span>
                          </div>
                          
                          {isOptionLocked && !showResults && (
                            <span className={styles.lockedBadge} style={{ fontSize: '11px', padding: '2px 8px' }}>
                              <Lock className={styles.lockedIcon} />
                            </span>
                          )}
                          
                          {showResults && (
                             <span className={styles.mcqMatrixResult}>
                               {((isT && isCorrectT) || (isF && isCorrectF)) ? <CheckCircle className={styles.resultIcon} /> : ((isT || isF) ? <XCircle className={styles.resultIcon} /> : null)}
                             </span>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    q.options.map((option) => {
                      const answer = answers[q.id];
                      const isSelected = answer?.selectedOption === option.letter;
                      const isLocked = answer?.isLocked;
                      const showResult = showResults && answer?.selectedOption !== undefined;
                      
                      let optionClass = styles.optionCard;
                      if (isSelected && !showResults) optionClass += ` ${styles.optionSelected}`;
                      if (isLocked && !showResults) optionClass += ` ${styles.optionLocked}`;
                      
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
                          onClick={() => !isLocked && handleAnswerSelect(q.id, option.letter)}
                          disabled={isLocked || showResults}
                          className={optionClass}
                          role="radio"
                          aria-checked={isSelected}
                          aria-disabled={isLocked || showResults}
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
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h3>Submit Quiz?</h3>
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
                    onClick={() => setShowSubmitConfirm(false)}
                    className={styles.modalCancel}
                  >
                    Continue Quiz
                  </button>
                  <button
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
            <div className={styles.autoSubmitNotice}>
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