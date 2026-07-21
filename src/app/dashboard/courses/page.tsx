"use client";

import { useDashboardData } from "@/hooks/useDashboardData";
import Loader from "@/components/UI/Loader";
import styles from "../Dashboard.module.css";
import { GraduationCap, Sparkles, CalendarDays, Timer, BookOpen, ArrowRight, Play, AlertTriangle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatDateTextGMT6, getExpiryDateGMT6 } from "@/lib/date-format";

export default function CoursesPage() {
    const { data, fetching, error } = useDashboardData();

    if (fetching && !data) return <div className={styles.loaderInline}>Securing your workspace...</div>;
    if (error) return <section className={styles.alertCard}><AlertTriangle size={18} /><span>{error}</span></section>;
    if (!data) return null;

    return (
        <div className={styles.coursesTab}>
          <div className={styles.coursesHeader}>
            <div className={styles.coursesHeaderLeft}>
              <div className={styles.coursesHeaderIcon}>
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 className={styles.coursesTitle}>My Learning</h2>
                <p className={styles.coursesSubtitle}>
                  {data.enrolledCourses.length} {data.enrolledCourses.length === 1 ? 'course' : 'courses'} enrolled
                </p>
              </div>
            </div>
            {data.enrolledCourses.length > 0 && (
              <div className={styles.coursesHeaderStats}>
                <div className={styles.coursesMiniStat}>
                  <span>{data.studyStats.completedLessons}</span>
                  <label>Lessons Done</label>
                </div>
                <div className={styles.coursesMiniStat}>
                  <span>{data.studyStats.averageProgress}%</span>
                  <label>Avg. Progress</label>
                </div>
              </div>
            )}
          </div>

          {data.enrolledCourses.length === 0 ? (
            <div className={styles.coursesEmpty}>
              <div className={styles.coursesEmptyIcon}>
                <Sparkles size={32} />
              </div>
              <h3>No courses yet</h3>
              <p>Your learning journey starts here. Enroll in a course to begin.</p>
            </div>
          ) : (
            <div className={styles.coursesGrid}>
              {data.enrolledCourses.map((course: any) => {
                const pct = course.progress.percentage;
                const circumference = 2 * Math.PI * 28;
                const dashOffset = circumference - (pct / 100) * circumference;
                const isComplete = pct === 100;
                return (
                  <article key={course.orderId} className={styles.courseCard2}>
                    <div className={styles.courseCardHeader}>
                      {course.imageUrl ? (
                        <Image src={course.imageUrl} alt={course.courseTitle} fill className={styles.courseCardImg} unoptimized />
                      ) : null}
                      <div className={styles.courseCardOverlay} />
                      <div className={styles.courseCardRing}>
                        <svg viewBox="0 0 64 64" className={styles.ringChart}>
                          <circle cx="32" cy="32" r="28" className={styles.ringBg} />
                          <circle cx="32" cy="32" r="28" className={styles.ringFill} strokeDasharray={circumference} strokeDashoffset={dashOffset} style={{ '--ring-color': isComplete ? '#10b981' : '#3b82f6' } as React.CSSProperties} />
                        </svg>
                        <span className={styles.ringLabel}>{pct}%</span>
                      </div>
                    </div>

                    <div className={styles.courseCardBody}>
                      <h3 className={styles.courseCardTitle}>{course.courseTitle}</h3>
                      <div className={styles.courseCardMeta}>
                        <div className={styles.courseCardMetaItem}><Timer size={13} /><span>{course.duration}</span></div>
                        <div className={styles.courseCardMetaItem}><BookOpen size={13} /><span>{course.progress.completedCount}/{course.progress.totalCount}</span></div>
                      </div>

                      <div className={styles.courseCardProgress}>
                        <div className={styles.courseCardTrack}>
                          <div className={styles.courseCardFill} style={{ width: `${pct}%`, background: isComplete ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }} />
                        </div>
                      </div>

                      <div className={styles.courseCardDates}>
                        <div className={styles.courseCardDate}><CalendarDays size={12} /><span>Joined {formatDateTextGMT6(course.enrolledAt)}</span></div>
                        <div className={styles.courseCardDate} style={{ color: 'var(--primary)' }}><Timer size={12} /><span>Expires {getExpiryDateGMT6(course.enrolledAt)}</span></div>
                      </div>

                      {course.courseSlug ? (
                        <Link href={`/study/${course.courseSlug}`} className={styles.courseCardAction}>
                          <Play size={15} />
                          {isComplete ? 'Review Course' : pct > 0 ? 'Continue Learning' : 'Start Learning'}
                          <ArrowRight size={15} />
                        </Link>
                      ) : (
                        <span className={styles.courseCardActionDisabled}>Access Restricted</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
    );
}
