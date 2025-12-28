"use client";

import { useState } from "react";
import styles from "./Study.module.css";
import {
    ChevronRight,
    PlayCircle,
    FileText,
    Video,
    CheckCircle2,
    Lock,
    ArrowLeft,
    ChevronDown
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import MCQSection from "@/components/Study/MCQSection";

interface Lesson {
    id: number;
    title: string;
    type: string;
    duration: string;
    completed?: boolean;
    active?: boolean;
    locked?: boolean;
}

interface Module {
    title: string;
    lessons: Lesson[];
}

const curriculum: Module[] = [
    {
        title: "Module 1: Introduction to FCPS Surgery",
        lessons: [
            { id: 1, title: "Exam Blueprint & Strategy", type: "video", duration: "12:45", completed: true },
            { id: 2, title: "Surgical Anatomy Basics", type: "text", duration: "10 mins read", completed: true },
            { id: 3, title: "Pre-operative Assessment", type: "video", duration: "45:00", active: true },
        ]
    },
    {
        title: "Module 2: General Surgery Principles",
        lessons: [
            { id: 4, title: "Wound Healing & Scars", type: "video", duration: "32:10", locked: true },
            { id: 5, title: "Surgical Infection Control", type: "text", duration: "15 mins read", locked: true },
        ]
    }
];

export default function StudyPage() {
    const [activeLesson, setActiveLesson] = useState<Lesson>(curriculum[0].lessons[2]);

    return (
        <div className={styles.layout}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <Link href="/" className={styles.backBtn}>
                        <ArrowLeft size={18} /> Exit Study
                    </Link>
                    <div className={styles.courseTitle}>
                        <h3>FCPS Surgery Masterclass</h3>
                        <div className={styles.progressSection}>
                            <div className={styles.progressBar}>
                                <div className={styles.progressFill} style={{ width: '40%' }}></div>
                            </div>
                            <span>40% Completed</span>
                        </div>
                    </div>
                </div>

                <div className={styles.curriculum}>
                    {curriculum.map((module, mIdx) => (
                        <div key={mIdx} className={styles.moduleSection}>
                            <button className={styles.moduleHeader}>
                                {module.title} <ChevronDown size={14} />
                            </button>
                            <div className={styles.lessonList}>
                                {module.lessons.map((lesson) => (
                                    <button
                                        key={lesson.id}
                                        className={`${styles.lessonItem} ${lesson.active ? styles.active : ""} ${lesson.locked ? styles.locked : ""}`}
                                        onClick={() => !lesson.locked && setActiveLesson(lesson)}
                                    >
                                        <div className={styles.lessonStatus}>
                                            {lesson.completed ? (
                                                <CheckCircle2 size={16} className={styles.completeIcon} />
                                            ) : lesson.locked ? (
                                                <Lock size={16} />
                                            ) : (
                                                <div className={styles.circle}></div>
                                            )}
                                        </div>
                                        <div className={styles.lessonInfo}>
                                            <span className={styles.lessonTitle}>{lesson.title}</span>
                                            <div className={styles.lessonMeta}>
                                                {lesson.type === 'video' ? <Video size={12} /> : <FileText size={12} />}
                                                {lesson.duration}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.breadcrumbs}>
                        <span>Module 1</span> <ChevronRight size={14} /> <span>{activeLesson.title}</span>
                    </div>
                    <button className={styles.completeBtn}>Mark as Complete</button>
                </header>

                <div className={styles.contentArea}>
                    <div className={styles.videoPlayer}>
                        {/* Mock Player */}
                        <div className={styles.mockVideo}>
                            <PlayCircle size={60} />
                            <span>Surgical Video Lecture Placeholder</span>
                        </div>
                    </div>

                    <article className={styles.article}>
                        <h1>{activeLesson.title}</h1>
                        <p>
                            In this high-yield session, we cover the essential components of pre-operative assessment for surgical candidates.
                            Understanding wait-times, co-morbidities like Diabetes and Hypertension, and surgical clearance protocols is critical for
                            the FCPS Part II examination.
                        </p>
                        <div className={styles.studyNotes}>
                            <h4>High Yield Points:</h4>
                            <ul>
                                <li>Always assess ASA score before induction.</li>
                                <li>Cardiac risk stratification using Lee's Revised Cardiac Risk Index.</li>
                                <li>Smoking cessation at least 4 weeks pre-op.</li>
                            </ul>
                        </div>
                    </article>

                    <MCQSection />
                </div>

                <footer className={styles.navBar}>
                    <button className={styles.navBtn} disabled>
                        <ArrowLeft size={18} /> Previous Lesson
                    </button>
                    <button className={styles.navBtn}>
                        Next Lesson <ChevronRight size={18} />
                    </button>
                </footer>
            </main>
        </div>
    );
}
