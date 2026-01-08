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
import CourseCurriculum, { CurriculumNode } from "@/components/Course/CourseCurriculum";
import { mockBasicMedicineData } from "@/lib/mockCurriculumData";

export default function StudyPage() {
    const [activeLesson, setActiveLesson] = useState<CurriculumNode | null>(null);

    const handleVideoSelect = (node: CurriculumNode) => {
        setActiveLesson(node);
    };

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
                    <CourseCurriculum
                        data={mockBasicMedicineData}
                        onVideoSelect={handleVideoSelect}
                        activeNodeId={activeLesson?.id}
                    />
                </div>
            </aside>

            {/* Main Content */}
            <main className={styles.main}>
                <header className={styles.header}>
                    <div className={styles.breadcrumbs}>
                        <span>Basic Medicine</span> <ChevronRight size={14} /> <span>{activeLesson?.title || 'Select a video'}</span>
                    </div>
                    <button className={styles.completeBtn} disabled={!activeLesson}>Mark as Complete</button>
                </header>

                <div className={styles.contentArea}>
                    <div className={styles.videoPlayer}>
                        {activeLesson ? (
                            activeLesson.type === 'youtube' && activeLesson.url ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    src={activeLesson.url.replace("watch?v=", "embed/")}
                                    title={activeLesson.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className={styles.iframePlayer}
                                ></iframe>
                            ) : activeLesson.type === 'self-hosted' ? (
                                <div className={styles.mockVideo}>
                                    <PlayCircle size={60} />
                                    <span>Playing External Video: {activeLesson.title}</span>
                                </div>
                            ) : (
                                <div className={styles.mockVideo}>
                                    <FileText size={60} />
                                    <span>Viewing Document: {activeLesson.title}</span>
                                </div>
                            )
                        ) : (
                            <div className={styles.mockVideo}>
                                <Video size={60} />
                                <span>Please select a video from the curriculum menu to begin studying.</span>
                            </div>
                        )}
                    </div>

                    {activeLesson && (
                        <article className={styles.article}>
                            <h1>{activeLesson.title}</h1>
                            <p>
                                Welcome to the lecture on {activeLesson.title}. Please watch the entire video before marking this section as complete. Make sure to take extensive notes!
                            </p>
                        </article>
                    )}

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
