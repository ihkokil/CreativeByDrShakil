"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import { COURSES, Course } from "@/constants/courses";
import styles from "./CourseDetail.module.css";
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
    const [expandedModules, setExpandedModules] = useState<number[]>([0]); // First module expanded by default

    useEffect(() => {
        if (params?.slug) {
            const courseSlug = params.slug as string;
            const foundCourse = COURSES.find(c => c.slug === courseSlug);
            if (foundCourse) {
                setCourse(foundCourse);
            } else {
                console.error("Course not found");
                // router.push("/courses");
            }
        }
    }, [params, router]);

    if (!course) {
        return (
            <main className={styles.main}>
                <Navbar />
                <div style={{ padding: "100px", textAlign: "center" }}>Loading...</div>
                <Footer />
            </main>
        );
    }

    const toggleModule = (index: number) => {
        setExpandedModules(prev => 
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    return (
        <main className={styles.main}>
            <Navbar />

            {/* Hero Section */}
            <header className={styles.hero}>
                <div className={styles.heroContent}>
                    <span className={styles.category}>{course.category}</span>
                    <h1 className={styles.title}>{course.title}</h1>
                    <div className={styles.meta}>
                        <div className={styles.metaItem}>
                            <Star size={18} color="#f59e0b" fill="#f59e0b" />
                            <span>{course.rating} Rating</span>
                        </div>
                        {course.enrolledCount && (
                            <div className={styles.metaItem}>
                                <Users size={18} />
                                <span>{course.enrolledCount.toLocaleString()} Students</span>
                            </div>
                        )}
                        <div className={styles.metaItem}>
                            <Clock size={18} />
                            <span>{course.duration}</span>
                        </div>
                        {course.level && (
                            <div className={styles.metaItem}>
                                <BarChart size={18} />
                                <span>{course.level}</span>
                            </div>
                        )}
                        {course.language && (
                            <div className={styles.metaItem}>
                                <Globe size={18} />
                                <span>{course.language}</span>
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
                    {course.description && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Overview</h2>
                            <p className={styles.description}>{course.description}</p>
                        </section>
                    )}

                    {/* What You'll Learn */}
                    {course.learningObjectives && course.learningObjectives.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>What You'll Learn</h2>
                            <ul className={styles.objectivesList}>
                                {course.learningObjectives.map((obj, idx) => (
                                    <li key={idx} className={styles.objectiveItem}>
                                        <CheckCircle2 size={20} className={styles.checkIcon} />
                                        <span>{obj}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* Curriculum */}
                    {course.curriculum && course.curriculum.length > 0 && (
                        <section className={styles.section}>
                            <h2 className={styles.sectionTitle}>Course Curriculum</h2>
                            <div className={styles.curriculum}>
                                {course.curriculum.map((module, idx) => (
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

                    {/* Instructor */}
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>Instructor</h2>
                        <div className={styles.instructorCard}>
                            <Image 
                                src={course.mainInstructor.image} 
                                alt={course.mainInstructor.name}
                                width={80}
                                height={80}
                                className={styles.instructorImage}
                            />
                            <div className={styles.instructorInfo}>
                                <h3>{course.mainInstructor.name}</h3>
                                <p className={styles.instructorRole}>{course.mainInstructor.role}</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Sticky Sidebar */}
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarImageWrapper}>
                        <Image
                            src={course.image || "/placeholder.svg"}
                            alt={course.title}
                            fill
                            style={{ objectFit: "cover" }}
                            className={styles.sidebarImage}
                        />
                    </div>
                    <div className={styles.sidebarContent}>
                        <div className={styles.priceSection}>
                            {course.originalPrice && (
                                <div className={styles.originalPrice}>{course.originalPrice}</div>
                            )}
                            <div className={styles.price}>{course.price === "Free" ? "Free" : course.price}</div>
                        </div>
                        
                        <button className={styles.enrollBtn}>
                            Enroll Now
                        </button>

                        <h4 style={{ marginBottom: "15px", color: "var(--text-primary)" }}>This course includes:</h4>
                        <ul className={styles.includesList}>
                            <li className={styles.includesItem}>
                                <MonitorPlay size={18} className={styles.includesIcon} />
                                <span>{course.duration} of on-demand video</span>
                            </li>
                            <li className={styles.includesItem}>
                                <FileText size={18} className={styles.includesIcon} />
                                <span>Comprehensive study materials</span>
                            </li>
                            <li className={styles.includesItem}>
                                <Star size={18} className={styles.includesIcon} />
                                <span>Full lifetime access</span>
                            </li>
                            <li className={styles.includesItem}>
                                <Award size={18} className={styles.includesIcon} />
                                <span>Certificate of completion</span>
                            </li>
                        </ul>
                    </div>
                </aside>
                
            </div>

            <Footer />
        </main>
    );
}
