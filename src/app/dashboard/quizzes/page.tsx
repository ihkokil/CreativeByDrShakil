'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Loader from "@/components/UI/Loader";
import Link from 'next/link';
import {
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  Trophy,
  AlertCircle,
  CheckCircle,
  Clock as ClockIcon,
  HelpCircle,
  Target,
  Play,
  RotateCcw,
  FileText,
  Lock,
  BookOpen,
  Folder,
  Download,
  Loader2,
  Check,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDisplayDate } from '@/lib/date-format';
import styles from './QuizzesPage.module.css';

interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  durationMinutes: number;
  numQuestionsToServe: number;
  status: string;
  allowMultipleAttempts: boolean;
  maxAttempts: number | null;
  attemptsCount: number;
  completedAttemptsCount?: number;
  topScore: number | null;
  avgScore: number | null;
  userRank?: number | null;
  totalParticipants?: number;
  _count: { questions: number };
  courseId?: string | null;
  courseName?: string | null;
  courseSlug?: string | null;
  moduleName?: string | null;
  isLocked?: boolean;
  availableAt?: string | null;
  attempt?: {
    id: string;
    status: string;
    netScore?: number;
    score?: number;
    attemptNumber: number;
    submittedAt: string | null;
  } | null;
  latestCompletedAttempt?: {
    id: string;
    status: string;
    netScore?: number;
    score?: number;
    attemptNumber: number;
    submittedAt: string | null;
  } | null;
  firstAttemptScore?: number | null;
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'duration' | 'alphabetical'>('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const limit = 20;

  const [pdfQuizInfo, setPdfQuizInfo] = useState<{ quiz: Quiz; questions: any[] } | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search query by 300ms to avoid excessive API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchQuizzes();
  }, [debouncedSearch, statusFilter, courseFilter, sortBy, page]);

  // PDF Generation Hook
  useEffect(() => {
    if (pdfQuizInfo && pdfContainerRef.current) {
      setTimeout(async () => {
        try {
          const { quiz } = pdfQuizInfo;
          const container = pdfContainerRef.current!;
          
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
          
          const bodyBgStyle = window.getComputedStyle(document.body).backgroundColor;
          const rgbMatch = bodyBgStyle.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          const bgColor = rgbMatch ? [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])] : [255, 255, 255];
          
          pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
          
          const cards = container.querySelectorAll('.pdf-question-card');
          
          for (let i = 0; i < cards.length; i++) {
            const el = cards[i] as HTMLElement;
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
            
            if (currentY + imgHeight > pdfHeight - 20 && currentY > 20) {
              pdf.addPage();
              pdf.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
              pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
              currentY = 20;
            }
            
            pdf.addImage(imgData, 'PNG', paddingX, currentY, usableWidth, imgHeight);
            currentY += imgHeight + 15;
          }
          
          const safeTitle = quiz.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          pdf.save(`quiz_${safeTitle}_answers.pdf`);
        } catch (err: any) {
          console.error('PDF generation failed:', err);
          alert('Failed to generate PDF. Please try again.');
        } finally {
          setPdfQuizInfo(null);
          setGeneratingPdfId(null);
        }
      }, 500);
    }
  }, [pdfQuizInfo]);

  const handleDownloadPDF = async (quiz: Quiz) => {
    try {
      setGeneratingPdfId(quiz.id);
      const res = await fetch(`/api/quiz/${quiz.id}/questions`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch questions');
      
      setPdfQuizInfo({ quiz, questions: data.questions || [] });
    } catch (err: any) {
      alert('Error generating PDF: ' + err.message);
      setGeneratingPdfId(null);
    }
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: debouncedSearch,
        sortBy: sortBy === 'newest' ? 'createdAt' : sortBy === 'oldest' ? 'createdAt' : sortBy === 'duration' ? 'durationMinutes' : 'title',
        sortOrder: sortBy === 'oldest' ? 'asc' : 'desc',
      });
      
      if (statusFilter) params.set('status', statusFilter);
      if (courseFilter) params.set('courseId', courseFilter);

      const res = await fetch(`/api/quiz?${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch quizzes');
      
      setQuizzes(data.quizzes || []);
      if (data.courses && Array.isArray(data.courses) && data.courses.length > 0) {
        setAvailableCourses(data.courses);
      }
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (quiz: Quiz) => {
    if (quiz.isLocked) {
      return (
        <span className={`${styles.badge} ${styles.badgeLocked}`}>
          <Lock className={styles.badgeIcon} /> Locked
        </span>
      );
    }
    if (quiz.attempt?.status === 'in_progress') {
      return <span className={`${styles.badge} ${styles.inProgress}`}><ClockIcon className={styles.badgeIcon} /> In Progress</span>;
    }
    const hasCompleted = Boolean(
      quiz.latestCompletedAttempt ||
      (quiz.completedAttemptsCount && quiz.completedAttemptsCount > 0) ||
      (quiz.attempt && (quiz.attempt.status === 'submitted' || quiz.attempt.status === 'auto_submitted' || quiz.attempt.status === 'completed'))
    );
    if (hasCompleted) {
      return <span className={`${styles.badge} ${styles.completed}`}><CheckCircle className={styles.badgeIcon} /> Completed</span>;
    }
    return <span className={`${styles.badge} ${styles.notAttempted}`}><AlertCircle className={styles.badgeIcon} /> Not Attempted</span>;
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${minutes} mins`;
  };

  const formatUnlockDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Group quizzes by course
  const courseGroups = useMemo(() => {
    const groups: { [key: string]: { name: string; id: string; quizzes: Quiz[] } } = {};
    
    quizzes.forEach(quiz => {
      const courseId = quiz.courseId || 'unassigned';
      const courseName = quiz.courseName || 'General Practice Quizzes';
      
      if (!groups[courseId]) {
        groups[courseId] = {
          id: courseId,
          name: courseName,
          quizzes: []
        };
      }
      groups[courseId].quizzes.push(quiz);
    });
    
    return Object.values(groups);
  }, [quizzes]);

  // Extract unique courses from available courses plus current quizzes
  const uniqueCourses = useMemo(() => {
    const map = new Map<string, string>();
    availableCourses.forEach(c => map.set(c.id, c.title));
    quizzes.forEach(q => {
      if (q.courseId && q.courseName) {
        map.set(q.courseId, q.courseName);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [availableCourses, quizzes]);

  if (loading && quizzes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Loader variant="inline" text="Loading quizzes..." />
          <p>Loading quizzes from your enrolled courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search quizzes by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
            aria-label="Search quizzes"
          />
        </div>
        
        <div className={styles.filters}>
          {uniqueCourses.length >= 1 && (
            <select
              value={courseFilter}
              onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
              className={styles.filterSelect}
              aria-label="Filter by course"
            >
              <option value="">All Enrolled Courses</option>
              {uniqueCourses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={styles.filterSelect}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            <option value="not_attempted">Not Attempted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.filterSelect}
            aria-label="Sort by"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="duration">Duration</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <div className={styles.emptyState}>
          <Trophy className={styles.emptyIcon} />
          <h3>No quizzes found</h3>
          <p>Quizzes from your enrolled courses will appear here. Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className={styles.quizList}>
            {courseGroups.map(group => (
              <div key={group.id} className={styles.courseSection}>
                <div className={styles.courseHeader}>
                  <div className={styles.courseHeaderLeft}>
                    <BookOpen className={styles.courseHeaderIcon} />
                    <h2 className={styles.courseTitle}>{group.name}</h2>
                  </div>
                  <span className={styles.courseBadge}>
                    {group.quizzes.length} {group.quizzes.length === 1 ? 'Quiz' : 'Quizzes'}
                  </span>
                </div>

                {group.quizzes.map(quiz => {
                  const isLocked = Boolean(quiz.isLocked);
                  const isInProgress = !isLocked && quiz.attempt?.status === 'in_progress';
                  const hasCompletedAttempt = Boolean(
                    quiz.latestCompletedAttempt ||
                    (quiz.completedAttemptsCount && quiz.completedAttemptsCount > 0) ||
                    (quiz.attemptsCount && quiz.attemptsCount > 0) ||
                    (quiz.attempt && (quiz.attempt.status === 'submitted' || quiz.attempt.status === 'auto_submitted' || quiz.attempt.status === 'completed'))
                  );
                  
                  const canStart = !isLocked && !isInProgress && (
                    !quiz.attempt || (
                      quiz.allowMultipleAttempts && (
                        !quiz.maxAttempts || 
                        quiz.maxAttempts === 0 || 
                        (quiz.attemptsCount ?? 0) < quiz.maxAttempts
                      )
                    )
                  );
                  
                  return (
                    <div key={quiz.id} className={`${styles.quizCard} ${isLocked ? styles.cardLocked : ''}`}>
                      <div className={styles.quizInfo}>
                        {quiz.moduleName && (
                          <div className={styles.moduleTag}>
                            <Folder size={12} />
                            <span>{quiz.moduleName}</span>
                          </div>
                        )}

                        {isLocked ? (
                          <span className={styles.quizTitleLink} style={{ cursor: 'not-allowed' }}>
                            {quiz.title}
                          </span>
                        ) : (
                          <Link href={`/dashboard/quizzes/${quiz.id}`} className={styles.quizTitleLink}>
                            {quiz.title}
                          </Link>
                        )}

                        {quiz.description && (
                          <p className={styles.quizDesc}>{quiz.description}</p>
                        )}

                        <div className={styles.badgeWrapper}>
                          {getStatusBadge(quiz)}
                          {isLocked && quiz.availableAt && (
                            <span className={styles.unlockDateText}>
                              Unlocks: {formatUnlockDate(quiz.availableAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.quizStats}>
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <HelpCircle className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Questions</span>
                            <span className={styles.statValue}>{quiz.numQuestionsToServe}</span>
                          </div>
                        </div>
                        
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <ClockIcon className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Duration</span>
                            <span className={styles.statValue}>{quiz.durationMinutes === 0 ? 'Unlimited' : formatDuration(quiz.durationMinutes)}</span>
                          </div>
                        </div>
                        
                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Target className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Attempts</span>
                            <span className={styles.statValue}>
                              {quiz.attemptsCount !== undefined ? quiz.attemptsCount : 0} {quiz.maxAttempts && quiz.maxAttempts > 0 ? `/ ${quiz.maxAttempts}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Top Score</span>
                            <span className={`${styles.statValue} ${quiz.topScore !== null ? styles.scoreValue : ''}`}>
                              {quiz.topScore !== null && quiz.topScore !== undefined ? `${quiz.topScore.toFixed(1)} Marks` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>Your Rank</span>
                            <span className={`${styles.statValue} ${quiz.userRank ? styles.rankValue : ''}`}>
                              {quiz.userRank ? `#${quiz.userRank} / ${quiz.totalParticipants || '—'}` : '—'}
                            </span>
                          </div>
                        </div>

                        <div className={styles.statItem}>
                          <div className={styles.statIconWrapper}>
                            <Trophy className={styles.statIcon} style={{ opacity: 0.4 }} />
                          </div>
                          <div className={styles.statContent}>
                            <span className={styles.statLabel}>1st Attempt</span>
                            <span className={`${styles.statValue} ${quiz.firstAttemptScore !== null && quiz.firstAttemptScore !== undefined ? styles.scoreValue : ''}`}>
                              {quiz.firstAttemptScore !== null && quiz.firstAttemptScore !== undefined ? `${quiz.firstAttemptScore.toFixed(1)} Marks` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className={styles.quizActions}>
                        {isLocked ? (
                          <button disabled className={`${styles.lockedBtn} ${styles.fullWidthAction}`} title="Module not yet unlocked">
                            <Lock size={14} /> Locked
                          </button>
                        ) : (
                          <>
                            {/* 1. Download Answer (Available ONLY after at least one completed attempt) */}
                            {hasCompletedAttempt && (
                              <button
                                type="button"
                                onClick={() => handleDownloadPDF(quiz)}
                                disabled={generatingPdfId === quiz.id}
                                className={`${styles.actionBtn} ${styles.resultBtn}`}
                                title="Download Questions, Official Answers & Explanations (PDF)"
                              >
                                {generatingPdfId === quiz.id ? (
                                  <>
                                    <Loader2 className={`${styles.btnIcon} ${styles.spinIcon}`} />
                                    <span>Downloading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className={styles.btnIcon} />
                                    <span>Download Answer</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* 2. Leaderboard (Available ONLY after at least one attempt) */}
                            {hasCompletedAttempt && (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}/attempts?tab=leaderboard`}
                                className={`${styles.actionBtn} ${styles.leaderboardBtn}`}
                                title="View Quiz Leaderboard and Student Rankings"
                              >
                                <Trophy className={styles.btnIcon} /> Leaderboard
                              </Link>
                            )}

                            {/* 3. Review Attempts (Available ONLY after at least one attempt) */}
                            {hasCompletedAttempt && (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}/attempts`}
                                className={`${styles.actionBtn} ${styles.reviewAttemptsBtn}`}
                                title="Review All Attempts with Detailed Score Analysis"
                              >
                                <RotateCcw className={styles.btnIcon} /> Review Attempts
                              </Link>
                            )}

                            {/* 4. Re-attempt / Continue / Start Quiz */}
                            {isInProgress && quiz.attempt?.id ? (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}/attempt/${quiz.attempt.id}`}
                                className={`${styles.actionBtn} ${styles.continueBtn} ${!hasCompletedAttempt ? styles.fullWidthAction : ''}`}
                                title="Continue In-Progress Quiz"
                              >
                                <RotateCcw className={styles.btnIcon} /> Continue
                              </Link>
                            ) : canStart ? (
                              <Link
                                href={`/dashboard/quizzes/${quiz.id}`}
                                className={`${styles.actionBtn} ${styles.startBtn} ${!hasCompletedAttempt ? styles.fullWidthAction : ''}`}
                                title={hasCompletedAttempt ? "Re-attempt Quiz" : "Start Quiz"}
                              >
                                <Play className={styles.btnIcon} /> {hasCompletedAttempt ? 'Re-attempt' : 'Start Quiz'}
                              </Link>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={styles.pageBtn}
              >
                Previous
              </button>
              <span className={styles.pageInfo}>
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={styles.pageBtn}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Hidden printable container for student PDF answer download */}
      <div 
        ref={pdfContainerRef} 
        style={{ 
          position: 'fixed', 
          left: '-9999px', 
          top: '0', 
          width: '800px', 
          zIndex: -1,
          opacity: 0,
          pointerEvents: 'none'
        }}
      >
        {pdfQuizInfo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '20px', borderRadius: '12px' }} className="pdf-question-card">
              <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>Quiz: {pdfQuizInfo.quiz.title}</h2>
              {pdfQuizInfo.quiz.description && <p style={{ opacity: 0.9 }}>{pdfQuizInfo.quiz.description}</p>}
            </div>
            {pdfQuizInfo.questions.map((question, index) => (
              <article key={question.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }} className="pdf-question-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Q{index + 1}.</span>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{question.questionText}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: '32px' }}>
                  {(question.questionType === 'true_false' || question.questionType === 'mcq') ? (
                    [
                      { letter: 'A', text: question.optionA },
                      { letter: 'B', text: question.optionB },
                      { letter: 'C', text: question.optionC },
                      { letter: 'D', text: question.optionD },
                      { letter: 'E', text: question.optionE },
                    ].map((option: any) => {
                      const correctStr = question.correctOption || 'F'.repeat(5);
                      const originalIdx = option.letter.charCodeAt(0) - 65;
                      const isCorrectT = correctStr[originalIdx] === 'T';
                      const isCorrectF = correctStr[originalIdx] === 'F';
                      
                      return (
                        <div key={`${question.id}-${option.letter}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '15px' }}><strong style={{ marginRight: '8px' }}>{option.letter}.</strong> {option.text}</span>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '54px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: isCorrectT ? 'var(--success, #10b981)' : 'var(--surface-soft, rgba(255,255,255,0.06))', color: isCorrectT ? 'white' : 'var(--text-muted, #888)' }}>
                              True
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '54px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: isCorrectF ? 'var(--success, #10b981)' : 'var(--surface-soft, rgba(255,255,255,0.06))', color: isCorrectF ? 'white' : 'var(--text-muted, #888)' }}>
                              False
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    [
                      { letter: 'A', text: question.optionA },
                      { letter: 'B', text: question.optionB },
                      { letter: 'C', text: question.optionC },
                      { letter: 'D', text: question.optionD },
                      { letter: 'E', text: question.optionE },
                    ].filter(o => o.text !== null && o.text !== undefined && String(o.text).trim() !== '').map((option: any) => {
                      const isCorrect = question.correctOption === option.letter;
                      return (
                        <div key={`${question.id}-${option.letter}`} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '8px', border: isCorrect ? '2px solid var(--success)' : '1px solid var(--border)', background: isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', background: isCorrect ? 'var(--success)' : 'var(--surface-soft)', color: isCorrect ? 'white' : 'var(--text-muted)' }}>
                            <Check size={16} />
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: isCorrect ? 600 : 400 }}><strong style={{ marginRight: '8px' }}>{option.letter}.</strong> {option.text}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                {question.explanation && (
                  <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-soft)', borderRadius: '8px', borderLeft: '4px solid var(--info)' }}>
                    <h4 style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--info)' }}>Explanation</h4>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{question.explanation}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}