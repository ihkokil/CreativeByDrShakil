"use client";

import { useRef, useCallback } from "react";
import styles from "./LessonPlayer.module.css";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import { Lock, FileText, Video as VideoIcon, Play } from "lucide-react";

import {
    MediaPlayer,
    MediaProvider,
    Poster,
    useMediaState,
    type MediaPlayerInstance,
} from "@vidstack/react";
import {
    DefaultVideoLayout,
    defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

interface LessonPlayerProps {
    lesson: {
        id: string;
        title: string;
        type: string;
        url?: string;
        attachments?: {
            name: string;
            url: string;
            type?: string;
            size?: number;
        }[];
        locked?: boolean;
    } | null;
    nextLesson?: () => void;
    onComplete?: () => void;
}

// ─── Inner component that renders the Vidstack player ─────────────────────────
function PlayerCore({
    playerRef,
    playerSrc,
    posterUrl,
    lesson,
    nextLesson,
    onComplete,
}: {
    playerRef: React.RefObject<MediaPlayerInstance | null>;
    playerSrc: string;
    posterUrl: string;
    lesson: NonNullable<LessonPlayerProps["lesson"]>;
    nextLesson?: () => void;
    onComplete?: () => void;
}) {
    // Only used to detect autoplay failure
    const autoPlayError = useMediaState("autoPlayError", playerRef);
    const paused = useMediaState("paused", playerRef);

    // Show fallback play button ONLY when autoplay was blocked by the browser
    const showFallbackPlay = !!autoPlayError && paused;

    const handleFallbackPlay = useCallback(() => {
        playerRef.current?.play();
    }, [playerRef]);

    return (
        <>
            <MediaPlayer
                ref={playerRef}
                src={playerSrc}
                autoPlay
                load="eager"
                viewType="video"
                streamType="on-demand"
                logLevel="silent"
                crossOrigin
                playsInline
                title={lesson.title}
                poster={posterUrl || undefined}
                className={styles.vidstackPlayer}
                onEnded={() => {
                    onComplete?.();
                    nextLesson?.();
                }}
            >
                <MediaProvider>
                    <Poster className="vds-poster" />
                </MediaProvider>
                <DefaultVideoLayout
                    seekStep={10}
                    icons={defaultLayoutIcons}
                />
            </MediaPlayer>

            {/* ── Fallback play — only if browser blocked autoplay ───── */}
            {showFallbackPlay && (
                <div className={styles.autoplayFallback}>
                    <button
                        className={styles.fallbackPlayBtn}
                        onClick={handleFallbackPlay}
                        aria-label="Play video"
                    >
                        <Play size={28} fill="white" strokeWidth={0} />
                    </button>
                </div>
            )}

            {/* ── Watermark — topmost, no pointer events ─────────────── */}
            <div className={styles.watermarkWrapper}>
                <VideoWatermark />
            </div>
        </>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function LessonPlayer({
    lesson,
    nextLesson,
    onComplete,
}: LessonPlayerProps) {
    const playerRef = useRef<MediaPlayerInstance | null>(null);

    const getYoutubeId = (rawUrl: string) => {
        if (!rawUrl) return null;
        const trimmed = rawUrl.trim();
        if (trimmed.startsWith("youtube/")) {
            return trimmed.replace("youtube/", "");
        }
        const regExp =
            /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = trimmed.match(regExp);
        if (match && match[2].length === 11) return match[2];
        if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
        return null;
    };

    const getVimeoId = (rawUrl: string) => {
        if (!rawUrl) return null;
        const trimmed = rawUrl.trim();
        if (trimmed.startsWith("vimeo/")) {
            return trimmed.replace("vimeo/", "");
        }
        const match = trimmed.match(/(?:vimeo\.com\/|video\/)(\d+)/);
        if (match && match[1]) return match[1];
        if (/^\d+$/.test(trimmed)) return trimmed;
        return null;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
    };

    const getPlayerSrc = (): string => {
        if (!lesson?.url) return "";
        const raw = lesson.url.trim();
        if (
            lesson.type === "youtube" ||
            raw.includes("youtube.com") ||
            raw.includes("youtu.be") ||
            raw.startsWith("youtube/")
        ) {
            const id = getYoutubeId(raw);
            return id ? `youtube/${id}` : raw;
        }
        if (
            lesson.type === "vimeo" ||
            raw.includes("vimeo.com") ||
            raw.startsWith("vimeo/")
        ) {
            const id = getVimeoId(raw);
            return id ? `vimeo/${id}` : raw;
        }
        return raw;
    };

    const getPosterUrl = (): string => {
        if (!lesson?.url) return "";
        const raw = lesson.url.trim();
        if (
            lesson.type === "youtube" ||
            raw.includes("youtube.com") ||
            raw.includes("youtu.be") ||
            raw.startsWith("youtube/")
        ) {
            const id = getYoutubeId(raw);
            return id
                ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
                : "";
        }
        return "";
    };

    // ── Guard states ────────────────────────────────────────────────────────
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
                <span>
                    This lesson is locked. Enroll in the course to gain
                    access.
                </span>
            </div>
        );
    }

    const lType = (lesson.type || "").toLowerCase();
    const isDocumentType =
        lType === "document" ||
        lType === "slide" ||
        (lesson.attachments && lesson.attachments.length > 0);
    const docExtensions = [
        ".pdf",
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".xls",
        ".xlsx",
        ".zip",
        ".rar",
    ];
    const lowerUrl = lesson.url?.toLowerCase() || "";
    const isDocUrl = docExtensions.some((ext) => lowerUrl.includes(ext));
    const isSlideTitle =
        lesson.title.toLowerCase().includes("slide") ||
        lesson.title.toLowerCase().includes("pdf");

    if (isDocumentType || isDocUrl || isSlideTitle) {
        const atts =
            lesson.attachments && lesson.attachments.length > 0
                ? lesson.attachments
                : lesson.url
                    ? [{ name: lesson.title || "Download File", url: lesson.url }]
                    : [];

        return (
            <div className={styles.documentContainer}>
                <div className={styles.documentHeader}>
                    <FileText
                        size={40}
                        style={{
                            color: "var(--primary, #3b82f6)",
                            marginBottom: "10px",
                        }}
                    />
                    <h2>{lesson.title}</h2>
                    <p>
                        {lesson.type === "slide"
                            ? "Slides & Presentations"
                            : "Documents & Resources"}
                    </p>
                </div>
                <div className={styles.attachmentsList}>
                    {atts.length === 0 ? (
                        <div
                            style={{
                                padding: "20px",
                                textAlign: "center",
                                color: "var(--text-muted)",
                            }}
                        >
                            No files or attachments have been uploaded for
                            this document yet.
                        </div>
                    ) : (
                        atts.map((att, idx) => {
                            const fullUrl = att.url
                                ? att.url.startsWith("/")
                                    ? `${process.env.NEXT_PUBLIC_UPLOADS_URL || ""}${att.url}`
                                    : att.url
                                : "";
                            const downloadHref = `/api/download?url=${encodeURIComponent(fullUrl)}&name=${encodeURIComponent(att.name || "document")}`;
                            return (
                                <a
                                    key={idx}
                                    href={downloadHref}
                                    className={styles.attachmentCard}
                                    onClick={() => onComplete?.()}
                                >
                                    <div className={styles.attIcon}>
                                        <FileText size={24} />
                                    </div>
                                    <div className={styles.attInfo}>
                                        <span className={styles.attName}>
                                            {att.name}
                                        </span>
                                    </div>
                                    <div className={styles.attAction}>
                                        Download
                                    </div>
                                </a>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    const playerSrc = getPlayerSrc();
    const posterUrl = getPosterUrl();

    return (
        <div
            className={styles.playerContainer}
            onContextMenu={handleContextMenu}
        >
            {/*
             * PlayerCore is separated so useMediaState hooks
             * can access the MediaPlayer context correctly.
             */}
            <PlayerCore
                key={lesson.id}
                playerRef={playerRef}
                playerSrc={playerSrc}
                posterUrl={posterUrl}
                lesson={lesson}
                nextLesson={nextLesson}
                onComplete={onComplete}
            />
        </div>
    );
}
