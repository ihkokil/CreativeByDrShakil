"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import { CheckoutModal } from "@/components/Checkout/CheckoutModal";
import { COURSES, Course } from "@/constants/courses";
import CourseCurriculum, { CurriculumNode } from "@/components/Course/CourseCurriculum";
import { mapDynamicCourseToCourse } from "@/lib/dynamic-course-client";
import styles from "./CourseDetail.module.css";
import { PublicTeacher, enrichCoursesWithTeachers } from "@/lib/teacher-directory";
import { 
    Clock, 
    Star, 
    Users, 
    Globe, 
    BarChart, 
    CheckCircle2, 
    PlayCircle, 
    ChevronDown, 
    ChevronUp,
    FileText,
    Award,
    MonitorPlay
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
    const [expandedModules, setExpandedModules] = useState<number[]>([]);

    // New: Track user purchase and progress state
    const [userEnrolled, setUserEnrolled] = useState(false);
    const [courseStarted, setCourseStarted] = useState(false);
    const [progressLoading, setProgressLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const loadTeachers = async () => {
            try {
                const response = await fetch("/api/teachers");
                const data = await response.json();
                if (!cancelled && response.ok && Array.isArray(data.teachers)) {
                    setTeachers(data.teachers);
                }
            } catch {
                // Keep static fallback data if teacher directory fetch fails.
            }
        };

        loadTeachers();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadCourse = async () => {
            if (!params?.slug) {
                return;
            }

            const courseSlug = params.slug as string;
            setLoadingCourse(true);

            try {
                const response = await fetch(`/api/courses/dynamic/${courseSlug}`);
                if (response.ok) {
                    const data = await response.json();
                    if (!cancelled && data.course) {
                        setCourse(mapDynamicCourseToCourse(data.course));
                        setDynamicCurriculum(Array.isArray(data.curriculum) ? data.curriculum : []);
                        setActiveDynamicNode(null);
                        setLoadingCourse(false);
                        return;
                    }
                }

                const foundStaticCourse = COURSES.find((item) => item.slug === courseSlug);
                if (!cancelled) {
                    setCourse(foundStaticCourse || null);
                    setDynamicCurriculum([]);
                    setActiveDynamicNode(null);
                    setLoadingCourse(false);
                }
            } catch {
                if (!cancelled) {
                    const foundStaticCourse = COURSES.find((item) => item.slug === courseSlug);
                    setCourse(foundStaticCourse || null);
                    setDynamicCurriculum([]);
                    setActiveDynamicNode(null);
                    setLoadingCourse(false);
                }
            }
        };

        loadCourse();

        return () => {
            cancelled = true;
        };
    }, [params, router]);

    // New: Fetch user dashboard and progress for this course
    useEffect(() => {
        let cancelled = false;
        const fetchUserCourseState = async () => {
            setProgressLoading(true);
            setUserEnrolled(false);
            setCourseStarted(false);
            try {
                // 1. Fetch dashboard to check if user is enrolled
                const dashRes = await fetch("/api/me/dashboard");
                if (!dashRes.ok) throw new Error("Failed to fetch dashboard");
                const dashData = await dashRes.json();
                const courseSlug = params?.slug as string;
                const enrolled = dashData.enrolledCourses?.some((c: any) => c.courseSlug === courseSlug);
                setUserEnrolled(enrolled);
                if (enrolled) {
                    // 2. Fetch progress for this course
                    const progRes = await fetch(`/api/study/courses/${courseSlug}/progress`);
                    if (progRes.ok) {
                        const progData = await progRes.json();
                        // If any lessons completed, course is started
                        setCourseStarted(Array.isArray(progData.progress?.completedLessonIds) && progData.progress.completedLessonIds.length > 0);
                    }
                }
            } catch {
                // ignore errors for now
            } finally {
                if (!cancelled) setProgressLoading(false);
            }
        };
        if (params?.slug) fetchUserCourseState();
        return () => { cancelled = true; };
    }, [params]);

    const displayCourse = useMemo(() => {
        if (!course) {
            return null;
        }
        if (course.dynamicSource) {
            return course;
        }
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
            if (!unique.has(key)) {
                unique.set(key, instructor);
            }
        });

        return Array.from(unique.values());
    }, [displayCourse]);

    useEffect(() => {
        if (displayCourse && !displayCourse.dynamicSource && displayCourse.curriculum?.length) {
            setExpandedModules(displayCourse.curriculum.map((_, index) => index));
        }
    }, [displayCourse]);

    if (loadingCourse) {
        return (
            <main className={styles.main}>
                <Navbar />
                <div style={{ padding: "100px", textAlign: "center" }}>Loading...</div>
                <Footer />
            </main>
        );
    }

    if (!displayCourse) {
        return (
            <main className={styles.main}>
                <Navbar />
                <div style={{ padding: "100px", textAlign: "center" }}>
                    <h2>Course not found</h2>
                    <button
                        style={{ marginTop: "16px" }}
                        className={styles.enrollBtn}
                        onClick={() => router.push("/courses")}
                    >
                        Back to Courses
                    </button>
                </div>
                <Footer />
            </main>
        );
    }

    const toggleModule = (index: number) => {
        setExpandedModules(prev => 
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const normalizePrice = (price: string) => {
        if (price.toLowerCase() === "free") return 0;
        const numeric = Number(price.replace(/[^\d.]/g, ""));
        return Number.isNaN(numeric) ? 0 : numeric;
    };

    const checkoutCourse = {
        id: String(displayCourse.id),
        title: displayCourse.title,
        price: normalizePrice(displayCourse.price),
    };


    return (
        <main className={styles.main}>
            <Navbar />

            {/* Hero Section */}
            <header className={styles.hero}>
                <div className={styles.heroContent}>
                    <span className={styles.category}>{displayCourse.category || "General"}</span>
                    <h1 className={styles.title}>{displayCourse.title}</h1>
                    <div className={styles.meta}>

                        {typeof displayCourse.enrolledCount === 'number' && displayCourse.enrolledCount > 0 && (
                            <div className={styles.metaItem}>
                                <Users size={18} />
                                <span>{displayCourse.enrolledCount.toLocaleString()} Students</span>
                            </div>
                        )}
                        <div className={styles.metaItem}>
                            <Clock size={18} />
                            <span>{displayCourse.duration}</span>
                        </div>

                        {displayCourse.language && (
                            <div className={styles.metaItem}>
                                <Globe size={18} />
                                <span>{displayCourse.language}</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.heroStats}>
                        {displayCourse.level && (
                            <div className={styles.heroStatCard}>
                                <BarChart size={16} />
                                <div>
                                    <span>Level</span>
                                    <strong>{displayCourse.level}</strong>
                                </div>
                            </div>
                        )}
                        <div className={styles.heroStatCard}>
                            <Star size={16} />
                            <div>
                                <span>Rating</span>
                                <strong>{displayCourse.rating.toFixed(1)}</strong>
                            </div>
                        </div>
                        {displayCourse.lastUpdated && (
                            <div className={styles.heroStatCard}>
                                <Award size={16} />
                                <div>
                                    <span>Updated</span>
                                    <strong>{displayCourse.lastUpdated}</strong>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className={styles.container}>
                
                {/* Left Column: Details */}
                <div className={styles.leftContent}>
                    
                    {/* Overview */}
                    {displayCourse.description && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Overview</h2>
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

                    {/* Curriculum */}
                    {displayCourse.curriculum && displayCourse.curriculum.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Curriculum</h2>
                            <div className={styles.curriculum}>
                                {displayCourse.curriculum.map((module, idx) => (
                                    <div key={idx} className={styles.module}>
                                        <div 
                                            className={styles.moduleHeader}
                                            onClick={() => toggleModule(idx)}
                                        >
                                            <span className={styles.moduleTitle}>{module.title}</span>
                                            {expandedModules.includes(idx) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                        </div>
                                        {expandedModules.includes(idx) && (
                                            <ul className={styles.lessonList}>
                                                {module.lessons.map((lesson, lessonIdx) => (
                                                    <li key={lessonIdx} className={styles.lessonItem}>
                                                        <div className={styles.lessonTitle}>
                                                            <PlayCircle size={16} className={styles.playIcon} />
                                                            <span>{lesson.title}</span>
                                                        </div>
                                                        <span>{lesson.duration}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {dynamicCurriculum.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Curriculum</h2>
                            <CourseCurriculum
                                data={dynamicCurriculum}
                                onVideoSelect={setActiveDynamicNode}
                                activeNodeId={activeDynamicNode?.id}
                            />
                        </section>
                    )}

                    {/* Instructor */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>{instructorList.length > 1 ? "Instructors" : "Instructor"}</h2>
                        <div className={styles.instructorsGrid}>
                            {instructorList.map((instructor) => (
                                <div key={`${displayCourse.id}-${instructor.name}`} className={styles.instructorCard}>
                                    <Image 
                                        src={instructor.image || "/placeholder.svg"} 
                                        alt={instructor.name}
                                        width={80}
                                        height={80}
                                        className={styles.instructorImage}
                                        unoptimized
                                    />
                                    <div className={styles.instructorInfo}>
                                        <h3>{instructor.name}</h3>
                                        <p className={styles.instructorRole}>{instructor.role}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Column: Sticky Sidebar */}
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarImageWrapper}>
                        <Image
                            src={displayCourse.image || "/placeholder.svg"}
                            alt={displayCourse.title}
                            fill
                            style={{ objectFit: "cover" }}
                            className={styles.sidebarImage}
                            unoptimized
                        />
                    </div>
                    <div className={styles.sidebarContent}>
                        <div className={styles.priceSection}>
                            {displayCourse.originalPrice && (
                                <div className={styles.originalPrice}>{displayCourse.originalPrice}</div>
                            )}
                            <div className={styles.price}>{displayCourse.price === "Free" ? "Free" : displayCourse.price}</div>
                        </div>

                        <div className={styles.sidebarHighlights}>
                            <div className={styles.sidebarHighlightItem}>
                                <CheckCircle2 size={16} />
                                <span>Structured curriculum with guided release flow</span>
                            </div>
                            <div className={styles.sidebarHighlightItem}>
                                <Users size={16} />
                                <span>{displayCourse.enrolledCount ? `${displayCourse.enrolledCount.toLocaleString()}+ students` : "Student access included"}</span>
                            </div>
                        </div>
                        
                        {/* Show Start Course or Enroll button based on user state */}
                        {progressLoading ? (
                            <button className={styles.enrollBtn} disabled>Loading...</button>
                        ) : userEnrolled ? (
                            courseStarted ? (
                                <button
                                    className={styles.enrollBtn}
                                    onClick={() => router.push(`/study/${params.slug}`)}
                                >
                                    Continue Course
                                </button>
                            ) : (
                                <button
                                    className={styles.enrollBtn}
                                    onClick={async () => {
                                        // Find first lesson node (not folder, not locked)
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
                                        const nodes = dynamicCurriculum.length > 0 ? dynamicCurriculum : (displayCourse.curriculum || []);
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
                                            if (!res.ok) throw new Error("Failed to start course");
                                            // Optionally update state here
                                            router.push(`/study/${params.slug}`);
                                        } catch {
                                            alert("Failed to start course. Please try again.");
                                        }
                                    }}
                                >
                                    Start Course
                                </button>
                            )
                        ) : (
                            <button
                                className={styles.enrollBtn}
                                onClick={() => setIsCheckoutOpen(true)}
                            >
                                Enroll Now
                            </button>
                        )}

                        <h4 className={styles.includesTitle}>This course includes:</h4>
                        <ul className={styles.includesList}>
                            <li className={styles.includesItem}>
                                <MonitorPlay size={18} className={styles.includesIcon} />
                                <span>1y access to video</span>
                            </li>
                            <li className={styles.includesItem}>
                                <FileText size={18} className={styles.includesIcon} />
                                <span>Comprehensive study materials</span>
                            </li>
                            <li className={styles.includesItem}>
                                <PlayCircle size={18} className={styles.includesIcon} />
                                <span>On demand live classes</span>
                            </li>
                            <li className={styles.includesItem}>
                                <Users size={18} className={styles.includesIcon} />
                                <span>Separate Q&A sessions</span>
                            </li>
                        </ul>
                    </div>
                </aside>
                
            </div>

            <Footer />

            <CheckoutModal
                course={checkoutCourse}
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
            />
        </main>
    );
}
