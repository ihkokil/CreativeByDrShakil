"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
    ClipboardList,
    Clock,
    HelpCircle,
    CheckCircle,
    AlertCircle,
    Play,
    RotateCcw,
    FileText,
    Trophy,
    Shield,
    Award,
    Target
} from "lucide-react";
import styles from "./StudyQuizPlayer.module.css";

interface StudyQuizPlayerProps {
    lesson: {
        id: string;
        title: string;
        type: string;
        url?: string;
        quizId?: string;
        locked?: boolean;
    };
    onComplete?: () => void;
}

interface QuizData {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    durationMinutes: number;
    numQuestionsToServe: number;
    marksPerCorrect: number;
    allowNegativeMarking: boolean;
    negativeValue: number;
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

export default function StudyQuizPlayer({ lesson, onComplete }: StudyQuizPlayerProps) {
    const router = useRouter();
    const params = useParams<{ slug: string }>();
    const slug = params?.slug || '';
    
    const quizId = lesson.quizId || lesson.url || lesson.id;
    const [quiz, setQuiz] = useState<QuizData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchQuiz = async () => {
            if (!quizId) return;
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/quiz/${quizId}`, { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load quiz details');
                }
                if (isMounted) {
                    setQuiz({
                        ...data.quiz,
                        attempt: data.attempt || null,
                    });
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || 'Error loading quiz details');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchQuiz();

        return () => {
            isMounted = false;
        };
    }, [quizId]);

    const returnUrl = slug ? `/study/${slug}?lesson=${lesson.id}` : '/dashboard/courses';

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
                    router.push(`/dashboard/quizzes/${quizId}/attempt/${data.attemptId}?returnUrl=${encodeURIComponent(returnUrl)}`);
                    return;
                }
                throw new Error(data.error || 'Failed to start quiz');
            }

            router.push(`/dashboard/quizzes/${quizId}/attempt/${data.attemptId}?returnUrl=${encodeURIComponent(returnUrl)}`);
        } catch (err: any) {
            setError(err.message);
            setStarting(false);
        }
    };

    const handleContinueQuiz = () => {
        if (quiz?.attempt?.id) {
            router.push(`/dashboard/quizzes/${quizId}/attempt/${quiz.attempt.id}?returnUrl=${encodeURIComponent(returnUrl)}`);
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

    if (loading) {
        return (
            <div className={styles.quizContainer}>
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Loading quiz details...</p>
                </div>
            </div>
        );
    }

    if (error || !quiz) {
        return (
            <div className={styles.quizContainer}>
                <div className={styles.errorState}>
                    <AlertCircle size={44} style={{ color: '#ef4444' }} />
                    <h3>Unable to load quiz</h3>
                    <p>{error || 'This quiz might be locked or unavailable.'}</p>
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

    const totalMarks = quiz.numQuestionsToServe * (quiz.marksPerCorrect || 1);

    return (
        <div className={styles.quizContainer}>
            {/* Header */}
            <div className={styles.quizHeader}>
                <div className={styles.headerLeft}>
                    <div className={styles.quizIconWrapper}>
                        <ClipboardList size={28} />
                    </div>
                    <div className={styles.quizTitleInfo}>
                        <div className={styles.quizBadgeRow}>
                            <span className={styles.typeBadge}>Online Quiz</span>
                            {isCompleted ? (
                                <span className={`${styles.statusBadge} ${styles.statusCompleted}`}>
                                    <CheckCircle size={13} /> Completed
                                </span>
                            ) : isInProgress ? (
                                <span className={`${styles.statusBadge} ${styles.statusInProgress}`}>
                                    <Clock size={13} /> In Progress
                                </span>
                            ) : (
                                <span className={`${styles.statusBadge} ${styles.statusAvailable}`}>
                                    <CheckCircle size={13} /> Available
                                </span>
                            )}
                        </div>
                        <h2 className={styles.quizTitle}>{quiz.title}</h2>
                        {quiz.description && (
                            <p className={styles.quizDescription}>{quiz.description}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Performance Summary Banner */}
            {isCompleted && quiz.attempt && (
                <div className={styles.performanceBanner}>
                    <div className={styles.performanceLeft}>
                        <Trophy size={30} className={styles.trophyIcon} />
                        <div>
                            <div className={styles.performanceScore}>
                                {Number(quiz.attempt.netScore).toFixed(1)} / {totalMarks} Marks
                            </div>
                            <div className={styles.performanceSubtext}>
                                Attempt #{quiz.attempt.attemptNumber}
                                {quiz.attempt.submittedAt && ` • Completed`}
                            </div>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/quizzes/${quizId}/result?attempt=${quiz.attempt.id}&returnUrl=${encodeURIComponent(returnUrl)}`}
                        className={styles.resultBtn}
                    >
                        <FileText size={16} /> View Detailed Answersheet
                    </Link>
                </div>
            )}

            {/* Quick Stats Grid */}
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statIcon}><Clock size={20} /></div>
                    <div className={styles.statDetails}>
                        <span className={styles.statLabel}>Duration</span>
                        <span className={styles.statValue}>{formatDuration(quiz.durationMinutes)}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}><HelpCircle size={20} /></div>
                    <div className={styles.statDetails}>
                        <span className={styles.statLabel}>Questions</span>
                        <span className={styles.statValue}>{quiz.numQuestionsToServe}</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}><Award size={20} /></div>
                    <div className={styles.statDetails}>
                        <span className={styles.statLabel}>Total Marks</span>
                        <span className={styles.statValue}>{totalMarks} Marks</span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}><Shield size={20} /></div>
                    <div className={styles.statDetails}>
                        <span className={styles.statLabel}>Negative Marks</span>
                        <span className={styles.statValue}>
                            {quiz.allowNegativeMarking ? `-${quiz.negativeValue || 0.25}` : 'None'}
                        </span>
                    </div>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statIcon}><Target size={20} /></div>
                    <div className={styles.statDetails}>
                        <span className={styles.statLabel}>Attempts</span>
                        <span className={styles.statValue}>
                            {quiz.allowMultipleAttempts 
                                ? (quiz.maxAttempts ? `Max ${quiz.maxAttempts}` : 'Unlimited') 
                                : 'Single Attempt'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Instructions */}
            {quiz.instructions && (
                <div className={styles.instructionsCard}>
                    <div className={styles.instructionsTitle}>
                        <AlertCircle size={16} /> Instructions & Guidelines
                    </div>
                    <p className={styles.instructionsText}>{quiz.instructions}</p>
                </div>
            )}

            {/* Action Bar */}
            <div className={styles.actionsArea}>
                {isInProgress ? (
                    <button
                        onClick={handleContinueQuiz}
                        className={styles.resumeBtn}
                    >
                        <RotateCcw size={18} /> Resume In-Progress Quiz
                    </button>
                ) : canStart ? (
                    <button
                        onClick={handleStartQuiz}
                        disabled={starting}
                        className={styles.startBtn}
                    >
                        <Play size={18} /> {starting ? 'Starting...' : (quiz.attempt ? 'Retake Quiz' : 'Start Quiz')}
                    </button>
                ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
                        All allowed attempts completed for this quiz.
                    </div>
                )}

                {isCompleted && quiz.attempt && (
                    <Link
                        href={`/dashboard/quizzes/${quizId}/result?attempt=${quiz.attempt.id}&returnUrl=${encodeURIComponent(returnUrl)}`}
                        className={styles.resultBtn}
                    >
                        <FileText size={16} /> Answersheet & Explanations
                    </Link>
                )}
            </div>
        </div>
    );
}
