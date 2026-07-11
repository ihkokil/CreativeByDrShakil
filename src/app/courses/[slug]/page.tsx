"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import { CheckoutModal } from "@/components/Checkout/CheckoutModal";
import { Course } from "@/constants/courses";
import { CurriculumNode } from "@/components/Course/CourseCurriculum";
import CourseLessonList from "@/components/Course/CourseLessonList";
import { mapDynamicCourseToCourse } from "@/lib/dynamic-course-client";
import styles from "./CourseDetail.module.css";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";
import AuthModal from "@/components/Auth/AuthModal";
import { useAuth } from "@/context/AuthContext";

// Premium Components
import CourseHero from "@/components/Course/CourseHero";
import CourseStats from "@/components/Course/CourseStats";
import CourseSidebar from "@/components/Course/CourseSidebar";
import CourseInstructors from "@/components/Course/CourseInstructors";

import { 
    CheckCircle2, 
    PlayCircle, 
    ChevronDown, 
    ChevronUp,
    Layout
} from "lucide-react";

export default function CourseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [course, setCourse] = useState<Course | null>(null);
    const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
    const [dynamicCurriculum, setDynamicCurriculum] = useState<CurriculumNode[]>([]);
    const [activeDynamicNode, setActiveDynamicNode] = useState<CurriculumNode | null>(null);
    const [loadingCourse, setLoadingCourse] = useState(true);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "register">("login");

    const { role: userRole } = useAuth();
    const [userEnrolled, setUserEnrolled] = useState(false);
    const [courseStarted, setCourseStarted] = useState(false);
    const [progressLoading, setProgressLoading] = useState(true);
    const { user } = useAuth();

    useEffect(() => {
        if (userRole === 'admin') {
            setUserEnrolled(true);
            // Even if admin is auto-enrolled, we still might want to check if they've 
            // started the course (marked any lesson complete) for the button label.
        }
    }, [userRole]);

    // Initial Data Fetching
    useEffect(() => {
        let cancelled = false;
        const loadTeachers = async () => {
            try {
                const response = await fetch("/api/teachers");
                const data = await response.json();
                if (!cancelled && response.ok && Array.isArray(data.teachers)) {
                    setTeachers(data.teachers);
                }
            } catch {}
        };
        loadTeachers();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        const loadCourse = async () => {
            if (!params?.slug) return;
            const courseSlug = params.slug as string;
            setLoadingCourse(true);
            try {
                const response = await fetch(`/api/courses/dynamic/${courseSlug}`);
                if (response.ok) {
                    const data = await response.json();
                    if (!cancelled && data.course) {
                        setCourse(mapDynamicCourseToCourse(data.course));
                        // Only set public curriculum if we are NOT enrolled.
                        // If enrolled, the other useEffect will handle it with personalized dates.
                        setDynamicCurriculum(prev => prev.length === 0 ? (Array.isArray(data.curriculum) ? data.curriculum : []) : prev);
                        setActiveDynamicNode(null);
                        setLoadingCourse(false);
                        return;
                    }
                }
                if (!cancelled) {
                    setCourse(null);
                    setLoadingCourse(false);
                }
            } catch {
                if (!cancelled) {
                    setCourse(null);
                    setLoadingCourse(false);
                }
            }
        };
        loadCourse();
        return () => { cancelled = true; };
    }, [params]);

    useEffect(() => {
        let cancelled = false;
        const fetchUserCourseState = async () => {
            if (!params?.slug) return;
            setProgressLoading(true);
            try {
                const token = localStorage.getItem("auth_token");
                const headers: Record<string, string> = {};
                if (token) headers["Authorization"] = `Bearer ${token}`;

                const dashRes = await fetch("/api/me/dashboard", { 
                    headers,
                    cache: 'no-store'
                });
                if (dashRes.ok) {
                    const dashData = await dashRes.json();
                    const courseSlug = params.slug as string;
                    const enrolled = dashData.enrolledCourses?.some((c: any) => c.courseSlug === courseSlug);
                    setUserEnrolled(enrolled);
                    if (enrolled) {
                        const progRes = await fetch(`/api/study/courses/${courseSlug}/progress`, { 
                            headers,
                            cache: 'no-store' 
                        });
                        if (progRes.ok) {
                            const progData = await progRes.json();
                            setCourseStarted(Array.isArray(progData.progress?.completedLessonIds) && progData.progress.completedLessonIds.length > 0);
                            
                            if (Array.isArray(progData.curriculum) && progData.curriculum.length > 0) {
                                setDynamicCurriculum(progData.curriculum);
                            }
                        }
                    }
                }
            } catch {} finally {
                if (!cancelled) setProgressLoading(false);
            }
        };
        fetchUserCourseState();
        return () => { cancelled = true; };
    }, [params]);

    // Mapped Course Data
    const displayCourse = useMemo(() => {
        if (!course) return null;
        if (course.dynamicSource) return course;
        return enrichCoursesWithTeachers([course], teachers)[0] || course;
    }, [course, teachers]);

    const instructorList = useMemo(() => {
        if (!displayCourse) return [];
        const main = displayCourse.mainInstructor;
        const subs = displayCourse.subInstructors || [];
        const list = [main, ...subs].filter(Boolean);
        const unique = new Map<string, typeof list[number]>();
        list.forEach((instructor) => {
            const key = instructor.id || `${instructor.name}-${instructor.role}`;
            if (!unique.has(key)) unique.set(key, instructor);
        });
        return Array.from(unique.values());
    }, [displayCourse]);

    // Handlers
    const onEnterCourse = async () => {
        if (courseStarted) {
            router.push(`/study/${params.slug}`);
            return;
        }
        // Start first lesson logic
        function findFirstLesson(nodes: any[]): any {
            for (const node of nodes) {
                if (node.type !== "folder" && !node.locked) return node;
                if (node.children?.length) {
                    const found = findFirstLesson(node.children);
                    if (found) return found;
                }
            }
            return null;
        }
        const nodes = dynamicCurriculum.length > 0 ? dynamicCurriculum : (displayCourse?.curriculum || []);
        const firstLesson = findFirstLesson(nodes);
        if (!firstLesson) {
            alert("No available lesson to start.");
            return;
        }
        try {
            const res = await fetch(`/api/study/courses/${params.slug}/progress`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lessonNodeId: firstLesson.id }),
            });
            if (res.ok) router.push(`/study/${params.slug}`);
            else throw new Error();
        } catch {
            alert("Failed to start course. Please try again.");
        }
    };

    if (loadingCourse) {
        return (
            <main className={styles.main}>
                <Navbar />
                <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
                <div className={styles.container}>
                    <div className={styles.leftContent}>
                        <div className={`${styles.skeleton} ${styles.skeletonStats}`} />
                        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80%', height: '40px' }} />
                        <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                        <div className={`${styles.skeleton} ${styles.skeletonText}`} />
                        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '60%' }} />
                    </div>
                    <div className={styles.sidebarWrapper}>
                        <div className={`${styles.skeleton} ${styles.skeletonSidebar}`} />
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    if (!displayCourse) {
        return (
            <main className={styles.main}>
                <Navbar />
                <div style={{ padding: "160px 0", textAlign: "center", minHeight: "60vh" }}>
                    <h2 style={{ marginBottom: "20px" }}>Course not found</h2>
                    <button className={styles.clearBtn} onClick={() => router.push("/courses")}>Back to Courses</button>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <Navbar />
            
            <CourseHero course={displayCourse} />

            <div className={styles.container}>
                <div className={styles.leftContent}>
                    
                    <CourseStats course={displayCourse} />

                    {/* Overview */}
                    {displayCourse.description && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}><Layout size={24} className="gradient-text" /> Course Overview</h2>
                            <p className={styles.description}>{displayCourse.description}</p>
                        </section>
                    )}

                    {/* What You'll Learn */}
                    {displayCourse.learningObjectives && displayCourse.learningObjectives.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>What You&apos;ll Learn</h2>
                            <ul className={styles.objectivesList}>
                                {displayCourse.learningObjectives.map((obj, idx) => (
                                    <li key={idx} className={styles.objectiveItem}>
                                        <CheckCircle2 size={20} className={styles.checkIcon} />
                                        <span>{obj}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Curriculum - Dynamic */}
                    {dynamicCurriculum.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Curriculum</h2>
                            <CourseLessonList curriculum={dynamicCurriculum} hasAccess={userEnrolled} courseSlug={params.slug as string} />
                        </section>
                    )}

                    {/* Curriculum - Static Fallback */}
                    {!displayCourse.dynamicSource && displayCourse.curriculum && displayCourse.curriculum.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Curriculum</h2>
                            <CourseLessonList
                                hasAccess={userEnrolled}
                                curriculum={displayCourse.curriculum.flatMap(module => 
                                    module.lessons.map(lesson => ({
                                        id: lesson.title,
                                        title: lesson.title,
                                        type: 'youtube',
                                        duration: lesson.duration
                                    }))
                                )}
                            />
                        </section>
                    )}

                    {/* Instructors */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>{instructorList.length > 1 ? "Meet your Instructors" : "Meet your Instructor"}</h2>
                        <CourseInstructors course={displayCourse} instructorList={instructorList} />
                    </section>
                </div>

                <div className={styles.sidebarWrapper}>
                    <CourseSidebar 
                        course={displayCourse}
                        progressLoading={progressLoading}
                        userEnrolled={userEnrolled}
                        courseStarted={courseStarted}
                        onEnterCourse={onEnterCourse}
                        onEnroll={() => {
                            if (!user) {
                                localStorage.setItem("post_verify_redirect", window.location.pathname);
                                setAuthMode("login");
                                setIsAuthOpen(true);
                            } else {
                                setIsCheckoutOpen(true);
                            }
                        }}
                    />
                </div>
            </div>

            <Footer />

            <CheckoutModal
                course={{
                    id: String(displayCourse.id),
                    title: displayCourse.title,
                    price: displayCourse.price === "Free" ? 0 : Number(displayCourse.price.replace(/[^\d.]/g, ""))
                }}
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
            />

            <AuthModal 
                isOpen={isAuthOpen} 
                onClose={() => setIsAuthOpen(false)} 
                defaultMode={authMode}
                onSuccess={() => {
                    setIsAuthOpen(false);
                    setIsCheckoutOpen(true);
                }}
            />
        </main>
    );
}
