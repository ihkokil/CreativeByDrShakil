"use client";

import { useEffect, useState } from "react";
import styles from "./LessonPlayer.module.css";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import { Lock, FileText, Video } from "lucide-react";

interface LessonPlayerProps {
    lesson: {
        id: string;
        title: string;
        type: string;
        url?: string;
        locked?: boolean;
    } | null;
    nextLesson?: () => void;
}

export default function LessonPlayer({ lesson, nextLesson }: LessonPlayerProps) {
    const [isIframeLoaded, setIsIframeLoaded] = useState(false);

    if (!lesson) {
        return (
            <div className={styles.mockVideo}>
                <Video size={60} />
                <span>No unlocked lessons are available yet.</span>
            </div>
        );
    }

    if (lesson.locked) {
        return (
            <div className={styles.mockVideo}>
                <Lock size={60} />
                <span>This lesson is locked. Enroll in the course to gain access.</span>
            </div>
        );
    }

    const toYoutubeEmbedUrl = (rawUrl: string) => {
        try {
            const url = new URL(rawUrl);
            let id = "";
            if (url.hostname.includes("youtube.com")) {
                if (url.pathname.startsWith("/embed/")) return rawUrl;
                id = url.searchParams.get("v") || "";
            } else if (url.hostname.includes("youtu.be")) {
                id = url.pathname.replace("/", "").trim();
            }

            if (id) {
                // Modest branding, no related videos, no info overlay
                return `https://www.youtube.com/embed/${id}?modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1&enablejsapi=1&origin=${window.location.origin}`;
            }
            return rawUrl;
        } catch {
            return rawUrl;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    // Auto-advance for YouTube videos
    useEffect(() => {
        if (!lesson || lesson.type !== "youtube" || !lesson.url) return;
        
        const onMessage = (event: MessageEvent) => {
            if (!event.data || typeof event.data !== "string") return;
            try {
                const data = JSON.parse(event.data);
                if (data.event === "onStateChange" && data.info === 0) {
                    // 0 = ended
                    if (nextLesson) nextLesson();
                }
            } catch (e) {
                // Not a JSON message or not from YouTube
            }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [lesson, nextLesson]);

    return (
        <div className={styles.playerContainer} onContextMenu={handleContextMenu}>
            <VideoWatermark />
            
            {/* The Click-Shield: Blocks clicking the YouTube title and logo */}
            <div className={styles.shieldTop} />
            <div className={styles.shieldBottomRight} />

            {lesson.type === "youtube" && lesson.url ? (
                <iframe
                    width="100%"
                    height="100%"
                    src={toYoutubeEmbedUrl(lesson.url)}
                    title={lesson.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className={styles.iframePlayer}
                    onLoad={() => setIsIframeLoaded(true)}
                />
            ) : lesson.type === "self-hosted" && lesson.url ? (
                <video
                    width="100%"
                    height="100%"
                    src={lesson.url}
                    controls
                    className={styles.iframePlayer}
                    controlsList="nodownload"
                    onEnded={nextLesson}
                />
            ) : (
                <div className={styles.mockVideo}>
                    <FileText size={60} />
                    <span>{lesson.title}</span>
                    <span className={styles.subtext}>
                        This lesson type is not yet supported in the player. 
                        Please contact support if this persists.
                    </span>
                </div>
            )}
        </div>
    );
}
