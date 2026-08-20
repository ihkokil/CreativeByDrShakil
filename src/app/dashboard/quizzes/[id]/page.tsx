'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronLeft,
  Play,
  Shield,
  Zap,
  Shuffle,
  RotateCcw,
} from 'lucide-react';
import styles from './page.module.css';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  marksPerCorrect: number;
  allowNegativeMarking: boolean;
  negativeValue: number;
  positionType: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  category: { displayName: string } | null;
  allowMultipleAttempts: boolean;
  maxAttempts: number | null;
  attempt: {
    id: string;
    status: string;
    attemptNumber: number;
    netScore: number;
    submittedAt: string | null;
  } | null;
  allAttempts?: any[];
}

export default function QuizDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const returnUrl = searchParams ? searchParams.get('returnUrl') : null;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}`, { cache: 'no-store' });
        const data = await res.json();
        
        if (!res.ok) {
          if (res.status === 403) {
            router.push(returnUrl || '/dashboard/quizzes');
            return;
          }
          throw new Error(data.error || 'Failed to load quiz');
        }
        
        setQuiz({
          ...data.quiz,
          attempt: data.attempt,
          allAttempts: data.allAttempts,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, router, returnUrl]);

  const handleStartQuiz = async () => {
    if (!quiz) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/start`, {
        method: 'POST',
      });
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

  const handleContinueQuiz = () => {
    if (quiz?.attempt?.id) {
      const targetUrl = returnUrl 
        ? `/dashboard/quizzes/${quizId}/attempt/${quiz.attempt.id}?returnUrl=${encodeURIComponent(returnUrl)}`
        : `/dashboard/quizzes/${quizId}/attempt/${quiz.attempt.id}`;
      router.push(targetUrl);
    }
  };

  const formatDuration = (minutes: number) => {
    if (!minutes || minutes === 0) return 'Unlimited';
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins} mins` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  const getPositionTypeLabel = (type: string) => {
    switch (type) {
      case 'best_attempt': return 'Best Attempt';
      case 'last_attempt': return 'Last Attempt';
      case 'first_attempt': return 'First Attempt';
      default: return type || 'Best Attempt';
    }
  };

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

  if (!quiz) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle className={styles.errorIcon} />
          <h2>Unable to Load Quiz</h2>
          <p>{error || 'Quiz not found or access denied'}</p>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            {returnUrl ? 'Back to Course' : 'Back to Quizzes'}
          </Link>
        </div>
      </div>
    );
  }

  const isInProgress = quiz.attempt?.status === 'in_progress';
  const isCompleted = quiz.attempt?.status === 'submitted' || quiz.attempt?.status === 'auto_submitted';
  
  const canStart = !isInProgress && (
    !quiz.attempt || (
      quiz.allowMultipleAttempts && (
        !quiz.maxAttempts || 
        quiz.maxAttempts === 0 || 
        (quiz.attempt?.attemptNumber ?? 0) < quiz.maxAttempts
      )
    )
  );

  const totalMarks = quiz.numQuestionsToServe * quiz.marksPerCorrect;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href={returnUrl || "/dashboard/quizzes"} className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
        </Link>
        
        <div className={styles.quizTitle}>
          <h1>{quiz.title}</h1>
          {quiz.category && (
            <span className={styles.categoryBadge}>{quiz.category.displayName}</span>
          )}
        </div>
        {quiz.description && (
          <p className={styles.description} style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
            {quiz.description}
          </p>
        )}
      </header>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <main className={styles.main}>
        <section className={styles.rulesSection}>
          <h2 className={styles.sectionTitle}>
            <HelpCircle className={styles.sectionIcon} />
            Quiz Overview
          </h2>

          <div className={styles.rulesGrid}>
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><Clock className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Duration</span>
                <span className={styles.ruleValue}>{formatDuration(quiz.durationMinutes)}</span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><HelpCircle className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Questions</span>
                <span className={styles.ruleValue}>{quiz.numQuestionsToServe} questions</span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><CheckCircle className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Total Marks</span>
                <span className={styles.ruleValue}>{totalMarks} marks</span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}>
                {quiz.allowNegativeMarking ? <XCircle className={styles.ruleIconSvg} /> : <Shield className={styles.ruleIconSvg} />}
              </div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Negative Marking</span>
                <span className={styles.ruleValue}>
                  {quiz.allowNegativeMarking 
                    ? `-${quiz.negativeValue} mark${quiz.negativeValue !== 1 ? 's' : ''} per wrong`
                    : 'No negative marking'
                  }
                </span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><RotateCcw className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Attempts</span>
                <span className={styles.ruleValue}>
                  {quiz.allowMultipleAttempts 
                    ? (quiz.maxAttempts && quiz.maxAttempts > 0 ? `Max ${quiz.maxAttempts} attempts` : 'Unlimited retries') 
                    : '1 attempt allowed'}
                </span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><Zap className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Ranking Method</span>
                <span className={styles.ruleValue}>{getPositionTypeLabel(quiz.positionType)}</span>
              </div>
            </div>
          </div>
        </section>

        {quiz.instructions && (
          <section className={styles.warningSection} style={{ marginBottom: '16px' }}>
            <div className={styles.warningCard} style={{ borderColor: 'rgba(14, 165, 233, 0.3)', background: 'rgba(14, 165, 233, 0.06)' }}>
              <HelpCircle className={styles.warningIcon} style={{ color: '#0ea5e9' }} />
              <div className={styles.warningContent}>
                <h3 style={{ color: '#0ea5e9' }}>Custom Instructions</h3>
                <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--foreground)' }}>{quiz.instructions}</p>
              </div>
            </div>
          </section>
        )}

        <section className={styles.warningSection}>
          <div className={styles.warningCard}>
            <AlertCircle className={styles.warningIcon} />
            <div className={styles.warningContent}>
              <h3>Exam Instructions & Rules</h3>
              <ul>
                <li>This quiz consists of <strong>{quiz.numQuestionsToServe} questions</strong> to be completed in <strong>{formatDuration(quiz.durationMinutes)}</strong>.</li>
                <li>Each correct answer carries <strong>{quiz.marksPerCorrect} mark{quiz.marksPerCorrect !== 1 ? 's' : ''}</strong>.{quiz.allowNegativeMarking ? ` Wrong answers will deduct ${quiz.negativeValue} mark${quiz.negativeValue !== 1 ? 's' : ''}.` : ' There is no negative marking.'}</li>
                <li>You can freely change your selected answers <strong>anytime before submission</strong> within the time limit.</li>
                <li>The quiz will be <strong>auto-submitted</strong> when the timer runs out.</li>
                <li>Do not <strong>close, refresh, or switch tabs</strong> during the quiz.</li>
                <li>Your answers are <strong>saved automatically</strong> in real time.</li>
              </ul>
            </div>
          </div>
        </section>

        {quiz.allAttempts && quiz.allAttempts.length > 0 && (
          <section className={styles.warningSection} style={{ marginTop: '16px' }}>
            <div className={styles.warningCard} style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.06)' }}>
              <CheckCircle className={styles.warningIcon} style={{ color: '#10b981' }} />
              <div className={styles.warningContent} style={{ width: '100%' }}>
                <h3 style={{ color: '#10b981', marginBottom: '12px' }}>Past Responses</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {quiz.allAttempts.map((pastAttempt: any, idx: number) => (
                    <Link
                      key={pastAttempt.id}
                      href={`/dashboard/quizzes/${quizId}/result?attempt=${pastAttempt.id}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px', 
                        background: 'var(--bg-secondary)', 
                        borderRadius: '8px', 
                        textDecoration: 'none',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>Attempt {quiz.allAttempts!.length - idx}</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {new Date(pastAttempt.submittedAt || pastAttempt.startedAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontWeight: 600, color: '#10b981' }}>Score: {pastAttempt.netScore}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', fontSize: '14px', fontWeight: 500 }}>
                          View Result <ChevronLeft style={{ transform: 'rotate(180deg)' }} size={16} />
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className={styles.actions}>
          <Link href={returnUrl || "/dashboard/quizzes"} className={styles.secondaryBtn}>
            <ChevronLeft className={styles.btnIcon} />
            {returnUrl ? 'Back to Course Study' : 'Back to Quizzes'}
          </Link>
          
          {isInProgress && (
            <button onClick={handleContinueQuiz} className={styles.continueBtn}>
              <Play className={styles.btnIcon} />
              Continue Quiz
            </button>
          )}
          
          {isCompleted && (
            <Link 
              href={`/dashboard/quizzes/${quizId}/result?attempt=${quiz.attempt?.id}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} 
              className={canStart ? styles.secondaryBtn : styles.primaryBtn}
            >
              <CheckCircle className={styles.btnIcon} />
              {canStart ? 'Review Answers' : 'View Result & Answers'}
            </Link>
          )}
          
          {canStart && (
            <button onClick={handleStartQuiz} disabled={starting} className={styles.primaryBtn}>
              {starting ? (
                <>
                  <div className={styles.spinnerSmall}></div>
                  Starting...
                </>
              ) : (
                <>
                  <Play className={styles.btnIcon} />
                  {quiz.attempt ? 'Retake Quiz' : 'Start Quiz'}
                </>
              )}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}