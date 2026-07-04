"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./Upcoming.module.css";
import { Calendar, UserCheck, PlayCircle } from "lucide-react";
import { formatDisplayDate } from "@/lib/date-format";
import { useAuth } from "@/context/AuthContext";
import { CheckoutModal } from "../Checkout/CheckoutModal";
import AuthModal from "../Auth/AuthModal";

type FeaturedCourse = {
    id: string;
    slug: string;
    title: string;
    duration: string;
    price: string;
    courseStartDate?: string | null;
};

import { useRouter } from "next/navigation";

export default function Upcoming() {
    const router = useRouter();
    const { user } = useAuth();

    const [featuredCourse, setFeaturedCourse] = useState<FeaturedCourse | null>(null);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [userEnrolled, setUserEnrolled] = useState(false);
    const [courseStarted, setCourseStarted] = useState(false);
    const [loading, setLoading] = useState(true);



    useEffect(() => {
        let cancelled = false;

        const loadFeaturedCourse = async () => {
            setLoading(true);
            try {
                const response = await fetch("/api/courses/featured");
                const data = await response.json();
                if (!cancelled && response.ok) {
                    setFeaturedCourse(data.course || null);
                }
            } catch {
                // Fallback handled below
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadFeaturedCourse();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const checkEnrollment = async () => {
            if (!user || !featuredCourse?.slug) {
                setUserEnrolled(false);
                return;
            }
            try {
                const token = localStorage.getItem("auth_token");
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const dashRes = await fetch("/api/me/dashboard", { headers });
                if (dashRes.ok) {
                    const dashData = await dashRes.json();
                    const enrolled = dashData.enrolledCourses?.some((c: any) => c.courseSlug === featuredCourse.slug);
                    if (!cancelled) {
                        setUserEnrolled(enrolled);
                        if (enrolled) {
                            const progRes = await fetch(`/api/study/courses/${featuredCourse.slug}/progress`, { headers });
                            if (progRes.ok) {
                                const progData = await progRes.json();
                                setCourseStarted(Array.isArray(progData.progress?.completedLessonIds) && progData.progress.completedLessonIds.length > 0);
                            }
                        }
                    }
                }
            } catch {}
        };
        checkEnrollment();
        return () => { cancelled = true; };
    }, [user, featuredCourse]);



    if (loading) return null; // Or a skeleton
    if (!featuredCourse) return null;

    const course = featuredCourse;

    const handleEnroll = () => {
        if (!user) {
            setIsAuthOpen(true);
        } else if (userEnrolled) {
            router.push(`/study/${course.slug}`);
        } else {
            setIsCheckoutOpen(true);
        }
    };

    const handleViewDetails = () => {
        router.push(`/courses/${course.slug}`);
    };

    const commencesLabel = course.courseStartDate
        ? `Commencing: ${formatDisplayDate(course.courseStartDate)}`
        : "Commencing soon";

    return (
        <section className="section-padding alt-bg">
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Most Popular Program</h2>
                    <p className={styles.subtitle}>Our most popular program chosen by students.</p>
                </div>

                <div className={styles.featuredBox}>
                    <div className={styles.timerWrapper} style={{ minWidth: 'auto', padding: '12px 32px', borderRadius: '40px' }}>
                        <div className={styles.timerLabel} style={{ marginBottom: 0, fontSize: '1.1rem' }}>MOST POPULAR</div>
                    </div>

                    <div className={styles.content}>
                        <div className={styles.info}>
                            <h3>{course.title}</h3>
                            <p>A comprehensive {course.duration} program covering high-yield material designed specifically for postgraduate success.</p>

                            <div className={styles.meta}>
                                <div className={styles.metaItem}>
                                    <Calendar size={18} />
                                    <span>{commencesLabel}</span>
                                </div>
                                <div className={styles.metaItem}>
                                    <UserCheck size={18} />
                                    <span>{course.price === "Free" ? "Free enrollment available" : `Most popular: ${course.price}`}</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <button className={styles.enrollBtn} onClick={handleEnroll}>
                                {userEnrolled ? (
                                    <><PlayCircle size={18} /> {courseStarted ? "Continue Learning" : "Start Learning"}</>
                                ) : "Enroll Now"}
                            </button>
                            <button className={styles.detailsBtn} onClick={handleViewDetails}>View Details</button>
                        </div>
                    </div>
                </div>
            </div>

            <CheckoutModal
                course={{
                    id: course.id,
                    title: course.title,
                    price: course.price === "Free" ? 0 : Number(course.price.replace(/[^\d.]/g, ""))
                }}
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
            />

            <AuthModal 
                isOpen={isAuthOpen} 
                onClose={() => setIsAuthOpen(false)} 
                defaultMode="login"
                onSuccess={() => {
                    setIsAuthOpen(false);
                    setIsCheckoutOpen(true);
                }}
            />
        </section>
    );
}
