'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Download,
  BarChart2,
  Trophy,
  User,
  Clock,
  TrendingUp,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  HelpCircle,
  Filter,
  FileText,
  Search,
} from 'lucide-react';
import styles from './page.module.css';

interface LeaderboardEntry {
  rank: number;
  attemptId: string;
  studentId: string;
  studentName: string;
  netScore: number;
  percentageScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number | null;
  submittedAt: string | null;
  attemptNumber: number;
  isAutoSubmitted: boolean;
  isCurrentUser: boolean;
}

interface QuestionAnalytics {
  questionId: string;
  questionText: string;
  totalAttempts: number;
  correctCount: number;
  correctPercentage: number;
  optionDistribution: Record<string, number>;
  mostCommonWrongOption: string | null;
}

interface QuizData {
  id: string;
  title: string;
  totalQuestions: number;
  durationMinutes: number;
}

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
  isAutoSubmitted: boolean;
}

interface ResultsData {
  quiz: QuizData;
  summary: {
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    averageTimeSeconds: number;
  };
  leaderboard: LeaderboardEntry[];
  perQuestionAnalytics: QuestionAnalytics[];
  attempt: AttemptData | null;
}

export default function TeacherQuizResultsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const attemptId = searchParams.get('attempt') || '';
  const [data, setData] = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'leaderboard' | 'questions' | 'attempt'>('overview');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'time' | 'attempt'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchResults();
  }, [quizId, attemptId]);

  const fetchResults = async () => {
    try {
      const params = new URLSearchParams();
      if (attemptId) params.set('attempt', attemptId);
      
      const res = await fetch(`/api/quiz/${quizId}/results?${params.toString()}`);
      const result = await res.json();
      
      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          router.push('/teacher/dashboard/quizzes');
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

  const formatTime = (seconds: number | null) => {
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

  const handleSort = (field: 'rank' | 'score' | 'time' | 'attempt') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const filteredLeaderboard = data?.leaderboard
    ?.filter(entry => 
      entry.studentName.toLowerCase().includes(search.toLowerCase())
    )
    ?.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'score': aVal = a.netScore; bVal = b.netScore; break;
        case 'time': aVal = a.timeTakenSeconds || 0; bVal = b.timeTakenSeconds || 0; break;
        case 'attempt': aVal = a.attemptNumber; bVal = b.attemptNumber; break;
        default: aVal = a.rank; bVal = b.rank;
      }
      const order = sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });

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
          <AlertCircle className={styles.errorIcon} />
          <h2>Unable to Load Results</h2>
          <p>{error || 'Results not found or access denied'}</p>
          <Link href="/teacher/dashboard/quizzes" className={styles.backBtn}>
            <ChevronLeft className={styles.btnIcon} />
            Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  const { quiz, summary, leaderboard, perQuestionAnalytics, attempt } = data;
  const isViewingAttempt = !!attemptId;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/teacher/dashboard/quizzes" className={styles.backLink}>
          <ChevronLeft className={styles.backIcon} />
          Back to Quizzes
        </Link>

        <div className={styles.quizHeader}>
          <h1 className={styles.quizTitle}>{quiz.title}</h1>
          <div className={styles.quizMeta}>
            <span className={styles.metaItem}>
              <Target className={styles.metaIcon} /> {quiz.totalQuestions} Questions
            </span>
            <span className={styles.metaItem}>
              <Clock className={styles.metaIcon} /> {quiz.durationMinutes} min
            </span>
            <span className={styles.metaItem}>
              <User className={styles.metaIcon} /> {summary.totalAttempts} Attempts
            </span>
          </div>
          
          {isViewingAttempt && attempt && (
            <div className={styles.attemptBadge}>
              <AlertCircle className={styles.badgeIcon} />
              Viewing Attempt #{attempt.attemptNumber} • {attempt.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'} • {formatTime(attempt.timeTakenSeconds)}
            </div>
          )}
        </div>
      </header>

      {error && <div className={styles.errorBanner}><AlertCircle className={styles.errorIcon} />{error}<button onClick={() => setError(null)} className={styles.errorDismiss}>&times;</button></div>}

      <main className={styles.main}>
        {!isViewingAttempt && (
          <>
            {/* Summary Cards */}
            <section className={styles.summarySection}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <TrendingUp className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardValue}>{summary.totalAttempts}</div>
                    <div className={styles.cardLabel}>Total Attempts</div>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <BarChart2 className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={`${styles.cardValue} ${getScoreColor(summary.averageScore)}`}>{summary.averageScore.toFixed(1)}%</div>
                    <div className={styles.cardLabel}>Average Score</div>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <Trophy className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={`${styles.cardValue} ${getScoreColor(summary.highestScore)}`}>{summary.highestScore.toFixed(1)}%</div>
                    <div className={styles.cardLabel}>Highest Score</div>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.cardIcon}>
                    <Clock className={styles.cardIconSvg} />
                  </div>
                  <div className={styles.cardContent}>
                    <div className={styles.cardValue}>{formatTime(summary.averageTimeSeconds)}</div>
                    <div className={styles.cardLabel}>Avg. Completion Time</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tab Navigation */}
            <nav className={styles.tabNav} role="tablist">
              <button
                role="tab"
                aria-selected={activeTab === 'overview'}
                onClick={() => setActiveTab('overview')}
                className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabActive : ''}`}
              >
                <BarChart2 className={styles.tabIcon} />
                Overview
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'leaderboard'}
                onClick={() => setActiveTab('leaderboard')}
                className={`${styles.tabBtn} ${activeTab === 'leaderboard' ? styles.tabActive : ''}`}
              >
                <Trophy className={styles.tabIcon} />
                Leaderboard ({leaderboard.length})
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'questions'}
                onClick={() => setActiveTab('questions')}
                className={`${styles.tabBtn} ${activeTab === 'questions' ? styles.tabActive : ''}`}
              >
                <HelpCircle className={styles.tabIcon} />
                Question Analytics ({perQuestionAnalytics.length})
              </button>
            </nav>

            {/* Tab Panels */}
            <div className={styles.tabContent}>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.overviewGrid}>
                    <div className={styles.overviewCard}>
                      <h3 className={styles.overviewTitle}>
                        <Trophy className={styles.overviewIcon} />
                        Score Distribution
                      </h3>
                      <div className={styles.scoreBars}>
                        {[
                          { label: '90-100%', count: leaderboard.filter(e => e.percentageScore >= 90).length },
                          { label: '80-89%', count: leaderboard.filter(e => e.percentageScore >= 80 && e.percentageScore < 90).length },
                          { label: '70-79%', count: leaderboard.filter(e => e.percentageScore >= 70 && e.percentageScore < 80).length },
                          { label: '60-69%', count: leaderboard.filter(e => e.percentageScore >= 60 && e.percentageScore < 70).length },
                          { label: 'Below 60%', count: leaderboard.filter(e => e.percentageScore < 60).length },
                        ].map((item, i) => (
                          <div key={i} className={styles.scoreBar}>
                            <span className={styles.scoreLabel}>{item.label}</span>
                            <div className={styles.barContainer}>
                              <div 
                                className={styles.barFill} 
                                style={{ width: `${summary.totalAttempts > 0 ? (item.count / summary.totalAttempts) * 100 : 0}%` }}
                              ></div>
                            </div>
                            <span className={styles.scoreCount}>{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className={styles.overviewCard}>
                      <h3 className={styles.overviewTitle}>
                        <Clock className={styles.overviewIcon} />
                        Time Analysis
                      </h3>
                      <div className={styles.timeStats}>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Fastest</span>
                          <span className={styles.timeValue}>
                            {leaderboard.length > 0 && leaderboard[0].timeTakenSeconds 
                              ? formatTime(leaderboard[0].timeTakenSeconds!) 
                              : 'N/A'}
                          </span>
                        </div>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Average</span>
                          <span className={styles.timeValue}>{formatTime(summary.averageTimeSeconds)}</span>
                        </div>
                        <div className={styles.timeStat}>
                          <span className={styles.timeLabel}>Slowest</span>
                          <span className={styles.timeValue}>
                            {leaderboard.length > 0 && leaderboard[leaderboard.length - 1].timeTakenSeconds 
                              ? formatTime(leaderboard[leaderboard.length - 1].timeTakenSeconds!) 
                              : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard Tab */}
              {activeTab === 'leaderboard' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.leaderboardHeader}>
                    <div className={styles.searchBox}>
                      <Search className={styles.searchIcon} />
                      <input
                        type="search"
                        placeholder="Search by student name..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.tableContainer}>
                    <table className={styles.leaderboardTable} role="table">
                      <thead>
                        <tr>
                          <th scope="col" onClick={() => handleSort('rank')} className={styles.sortable}>
                            Rank <TrendingUp className={`${styles.sortIcon} ${sortBy === 'rank' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Student</th>
                          <th scope="col" onClick={() => handleSort('score')} className={styles.sortable}>
                            Score <TrendingUp className={`${styles.sortIcon} ${sortBy === 'score' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Correct / Wrong / Skipped</th>
                          <th scope="col" onClick={() => handleSort('time')} className={styles.sortable}>
                            Time <TrendingUp className={`${styles.sortIcon} ${sortBy === 'time' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col" onClick={() => handleSort('attempt')} className={styles.sortable}>
                            Attempt <TrendingUp className={`${styles.sortIcon} ${sortBy === 'attempt' ? (sortOrder === 'asc' ? styles.asc : styles.desc) : ''}`} />
                          </th>
                          <th scope="col">Status</th>
                          <th scope="col"><span className={styles.visuallyHidden}>Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeaderboard?.map((entry, index) => (
                          <tr key={entry.attemptId} className={entry.isCurrentUser ? styles.currentUser : ''}>
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
                              <span className={`${styles.scoreValue} ${getScoreColor(entry.netScore)}`}>
                                {entry.netScore.toFixed(1)}%
                              </span>
                            </td>
                            <td className={styles.detailCell}>
                              <span className={`${styles.detailItem} text-success`}>{entry.correctCount}</span>
                              <span className={`${styles.detailItem} text-error`}>{entry.wrongCount}</span>
                              <span className={`${styles.detailItem} text-warning`}>{entry.skippedCount}</span>
                            </td>
                            <td className={styles.timeCell}>{formatTime(entry.timeTakenSeconds)}</td>
                            <td className={styles.attemptCell}>#{entry.attemptNumber}</td>
                            <td className={styles.statusCell}>
                              <span className={`${styles.statusBadge} ${entry.isAutoSubmitted ? styles.autoSubmitted : styles.submitted}`}>
                                {entry.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'}
                              </span>
                            </td>
                            <td>
                              <Link 
                                href={`/teacher/dashboard/quizzes/${quizId}/results?attempt=${entry.attemptId}`}
                                className={styles.viewBtn}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {leaderboard.length > 20 && (
                    <p className={styles.leaderboardNote}>
                      Showing all {leaderboard.length} participants
                    </p>
                  )}
                </div>
              )}

              {/* Question Analytics Tab */}
              {activeTab === 'questions' && (
                <div className={styles.tabPanel} role="tabpanel">
                  <div className={styles.questionsAnalytics}>
                    {perQuestionAnalytics.map((q, index) => (
                      <div key={q.questionId} className={styles.analyticsCard}>
                        <div className={styles.analyticsHeader}>
                          <span className={styles.analyticsNumber}>Q{index + 1}</span>
                          <h4 className={styles.analyticsQuestion}>{q.questionText}</h4>
                          <div className={styles.analyticsStats}>
                            <span className={`${styles.analyticsStat} ${q.correctPercentage >= 70 ? 'text-success' : q.correctPercentage >= 50 ? 'text-warning' : 'text-error'}`}>
                              {q.correctPercentage.toFixed(1)}% correct
                            </span>
                            <span className={styles.analyticsStat}>{q.totalAttempts} attempts</span>
                          </div>
                        </div>
                        
                        <div className={styles.optionDistribution}>
                          {Object.entries(q.optionDistribution).map(([option, count]) => {
                            const percentage = q.totalAttempts > 0 ? (count / q.totalAttempts) * 100 : 0;
                            const isCorrect = option === q.questionText.split('Correct Option: ')[1]?.split(',')[0] || false;
                            return (
                              <div key={option} className={`${styles.optionBar} ${isCorrect ? styles.correctBar : ''}`}>
                                <div className={styles.optionInfo}>
                                  <span className={styles.optionLabel}>Option {option}</span>
                                  <span className={styles.optionCount}>{count} ({percentage.toFixed(1)}%)</span>
                                </div>
                                <div 
                                  className={styles.optionBarFill} 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {q.mostCommonWrongOption && (
                          <div className={styles.wrongNote}>
                            <XCircle className={styles.wrongIcon} />
                            Most common wrong answer: Option {q.mostCommonWrongOption}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

          {/* Single Attempt View */}
          {isViewingAttempt && attempt && (
            <div className={styles.attemptView}>
              <div className={styles.attemptHeader}>
                <div>
                  <h2 className={styles.attemptTitle}>Attempt Details</h2>
                  <p className={styles.attemptSubtitle}>
                    Attempt #{attempt.attemptNumber} • {attempt.isAutoSubmitted ? 'Auto-submitted' : 'Submitted'} • {formatTime(attempt.timeTakenSeconds)}
                  </p>
                </div>
                <Link href={`/teacher/dashboard/quizzes/${quizId}/results`} className={styles.backToResults}>
                  <ChevronLeft className={styles.btnIcon} />
                  Back to Leaderboard
                </Link>
              </div>
              
              <div className={styles.attemptSummary}>
                <div className={styles.attemptScoreCard}>
                  <div className={`${styles.attemptScoreValue} ${getScoreColor(attempt.percentageScore)}`}>
                    {attempt.percentageScore.toFixed(1)}%
                  </div>
                  <div className={styles.attemptScoreLabel}>Final Score</div>
                </div>
                <div className={styles.attemptStats}>
                  <div className={`${styles.attemptStat} text-success`}>
                    <div className={styles.attemptStatValue}>{attempt.correctCount}</div>
                    <div className={styles.attemptStatLabel}>Correct</div>
                  </div>
                  <div className={`${styles.attemptStat} text-error`}>
                    <div className={styles.attemptStatValue}>{attempt.wrongCount}</div>
                    <div className={styles.attemptStatLabel}>Wrong</div>
                  </div>
                  <div className={`${styles.attemptStat} text-warning`}>
                    <div className={styles.attemptStatValue}>{attempt.skippedCount}</div>
                    <div className={styles.attemptStatLabel}>Skipped</div>
                  </div>
                  {attempt.negativeMarks > 0 && (
                    <div className={`${styles.attemptStat} text-error`}>
                      <div className={styles.attemptStatValue}>-{attempt.negativeMarks.toFixed(2)}</div>
                      <div className={styles.attemptStatLabel}>Penalty</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Would show detailed question review here */}
            </div>
          )}
      </main>
    </div>
  );
}