"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LessonPlayer.module.css";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import { Lock, FileText, Video as VideoIcon } from "lucide-react";

// Vidstack Imports
import { MediaPlayer, MediaProvider, Poster, Track, type MediaPlayerInstance } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";

// Vidstack Styles
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface LessonPlayerProps {
    lesson: {
        id: string;
        title: string;
        type: string;
        url?: string;
        attachments?: { name: string; url: string; type?: string; size?: number }[];
        locked?: boolean;
    } | null;
    nextLesson?: () => void;
    onComplete?: () => void;
}

export default function LessonPlayer({ lesson, nextLesson, onComplete }: LessonPlayerProps) {
    const player = useRef<MediaPlayerInstance>(null);

    if (!lesson) {
        return (
            <div className={styles.mockVideo}>
                <VideoIcon size={60} />
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

    const getYoutubeId = (rawUrl: string) => {
        try {
            const url = new URL(rawUrl);
            if (url.hostname.includes("youtube.com")) {
                return url.searchParams.get("v") || url.pathname.split("/").pop();
            } else if (url.hostname.includes("youtu.be")) {
                return url.pathname.replace("/", "").trim();
            }
            return null;
        } catch {
            return null;
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    if (lesson.type === 'document') {
        const atts = lesson.attachments && lesson.attachments.length > 0 
            ? lesson.attachments 
            : lesson.url ? [{ name: 'Document', url: lesson.url }] : [];
            
        return (
            <div className={styles.documentContainer}>
                <div className={styles.documentHeader}>
                    <FileText size={40} style={{ color: 'var(--primary, #3b82f6)', marginBottom: '10px' }} />
                    <h2>{lesson.title}</h2>
                    <p>Documents & Resources</p>
                </div>
                <div className={styles.attachmentsList}>
                    {atts.map((att, idx) => {
                        const fullUrl = att.url ? (att.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_UPLOADS_URL || ''}${att.url}` : att.url) : '';
                        return (
                            <a key={idx} href={fullUrl} target="_blank" rel="noopener noreferrer" className={styles.attachmentCard} onClick={() => onComplete?.()}>
                                <div className={styles.attIcon}>
                                    <FileText size={24} />
                                </div>
                                <div className={styles.attInfo}>
                                    <span className={styles.attName}>{att.name}</span>
                                </div>
                                <div className={styles.attAction}>
                                    Download / View
                                </div>
                            </a>
                        );
                    })}
                </div>
            </div>
        );
    }

    const videoSrc = lesson.type === "youtube" 
        ? `youtube/${getYoutubeId(lesson.url || "")}`
        : lesson.url;

    return (
        <div className={styles.playerContainer} onContextMenu={handleContextMenu}>
            {/* Protective Overlay for Branding/Link Protection */}
            <div className={styles.vidstackShield} />
            
            <MediaPlayer
                ref={player}
                title={lesson.title}
                src={videoSrc || ""}
                crossOrigin
                playsInline
                onEnded={() => {
                    onComplete?.();
                    nextLesson?.();
                }}
                className={styles.vidstackPlayer}
                viewType="video"
                streamType="on-demand"
            >
                <MediaProvider>
                    {/* Poster can be added here if available */}
                </MediaProvider>

                {/* Default Layout provides all the controls: speed, volume, quality, etc. */}
                <DefaultVideoLayout 
                    icons={defaultLayoutIcons}
                />

                {/* Watermark stays on top of everything */}
                <div className={styles.watermarkWrapper}>
                    <VideoWatermark />
                </div>
            </MediaPlayer>

            {/* Error/Fallback for unsupported types */}
            {lesson.type !== "youtube" && lesson.type !== "self-hosted" && (
                <div className={styles.mockVideo}>
                    <FileText size={60} />
                    <span>{lesson.title}</span>
                    <span className={styles.subtext}>
                        Unsupported lesson type. Please contact support.
                    </span>
                </div>
            )}
        </div>
    );
}
