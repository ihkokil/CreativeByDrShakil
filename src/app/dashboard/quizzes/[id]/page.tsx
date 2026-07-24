'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
}

export default function QuizDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}`);
        const data = await res.json();
        
        if (!res.ok) {
          if (res.status === 403) {
            router.push('/dashboard/quizzes');
            return;
          }
          throw new Error(data.error || 'Failed to load quiz');
        }
        
        setQuiz({
          ...data.quiz,
          attempt: data.attempt,
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId, router]);

  const handleStartQuiz = async () => {
    if (!quiz) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/quiz/${quizId}/start`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (data.attemptId) {
          router.push(`/dashboard/quizzes/${quizId}/attempt/${data.attemptId}`);
          return;
        }
        throw new Error(data.error || 'Failed to start quiz');
      }
      
      router.push(`/dashboard/quizzes/${quizId}/attempt/${data.attemptId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start quiz');
    } finally {
      setStarting(false);
    }
  };

  const handleContinueQuiz = () => {
    if (quiz?.attempt?.id) {
      router.push(`/dashboard/quizzes/${quizId}/attempt/${quiz.attempt.id}`);
    }
  };

  const formatDuration = (minutes: number) => {
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
      default: return type;
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

  if (error || !quiz) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle className={styles.errorIcon} />
          <h2>Unable to Load Quiz</h2>
          <p>{error || 'Quiz not found or access denied'}</p>
          <Link href="/dashboard/quizzes" className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
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
        <Link href="/dashboard/quizzes" className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          Back to Quizzes
        </Link>
        
        <div className={styles.quizTitle}>
          <h1>{quiz.title}</h1>
        </div>
      </header>

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
                    ? `-${(quiz.negativeValue <= 1 && quiz.negativeValue > 0 ? quiz.negativeValue * 100 : quiz.negativeValue).toFixed(0)}% per wrong`
                    : 'Not applicable'
                  }
                </span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><Zap className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Answer Locking</span>
                <span className={styles.ruleValue}>Answers lock once selected</span>
              </div>
            </div>
            
            <div className={styles.ruleCard}>
              <div className={styles.ruleIcon}><RotateCcw className={styles.ruleIconSvg} /></div>
              <div className={styles.ruleContent}>
                <span className={styles.ruleLabel}>Ranking</span>
                <span className={styles.ruleValue}>{getPositionTypeLabel(quiz.positionType)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.warningSection}>
          <div className={styles.warningCard}>
            <AlertCircle className={styles.warningIcon} />
            <div className={styles.warningContent}>
              <h3>Instructions</h3>
              <ul>
                <li>This quiz consists of <strong>{quiz.numQuestionsToServe} questions</strong> to be completed in <strong>{formatDuration(quiz.durationMinutes)}</strong>.</li>
                <li>Each correct answer carries <strong>{quiz.marksPerCorrect} mark{quiz.marksPerCorrect !== 1 ? 's' : ''}</strong>.{quiz.allowNegativeMarking ? ` Wrong answers will deduct ${quiz.negativeValue <= 1 && quiz.negativeValue > 0 ? quiz.negativeValue * 100 : quiz.negativeValue}% of the marks (${quiz.marksPerCorrect * (quiz.negativeValue <= 1 && quiz.negativeValue > 0 ? quiz.negativeValue : quiz.negativeValue / 100)} marks).` : ' There is no negative marking.'}</li>
                <li>Once you select an answer, it <strong>cannot be changed</strong>.</li>
                <li>The quiz will be <strong>auto-submitted</strong> when the timer runs out.</li>
                <li>Do not <strong>close, refresh, or switch tabs</strong> during the quiz.</li>
                <li>Your answers are <strong>saved automatically</strong> in real time.</li>
              </ul>
            </div>
          </div>
        </section>

        <footer className={styles.actions}>
          <Link href="/dashboard/quizzes" className={styles.secondaryBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
          </Link>
          
          {isInProgress && (
            <button onClick={handleContinueQuiz} className={styles.continueBtn}>
              <Play className={styles.btnIcon} />
              Continue Quiz
            </button>
          )}
          
          {isCompleted && (
            <Link 
              href={`/dashboard/quizzes/${quizId}/result?attempt=${quiz.attempt?.id}`} 
              className={canStart ? styles.secondaryBtn : styles.primaryBtn}
            >
              <CheckCircle className={styles.btnIcon} />
              {canStart ? 'View Last Result' : 'View Result'}
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
                  {quiz.attempt ? 'Start New Attempt' : 'Start Quiz'}
                </>
              )}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}