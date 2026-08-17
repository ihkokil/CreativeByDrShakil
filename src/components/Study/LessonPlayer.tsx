"use client";

import { Lock, FileText, Video as VideoIcon } from "lucide-react";
import VideoWatermark from "@/components/ContentProtection/VideoWatermark";
import VidstackPlayer from "./VidstackPlayer";
import StudyQuizPlayer from "./StudyQuizPlayer";
import styles from "./LessonPlayer.module.css";

interface LessonPlayerProps {
  lesson: {
    id: string;
    title: string;
    type: string;
    url?: string;
    quizId?: string;
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

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function LessonPlayer({
  lesson,
  onComplete,
}: LessonPlayerProps) {
  const getYoutubeId = (rawUrl: string): string | null => {
    if (!rawUrl) return null;
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith("youtube/")) {
      const clean = trimmed.replace("youtube/", "").trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    const regExp =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(regExp);
    if (match && match[1]) return match[1];

    const fallbackRegExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const matchFallback = trimmed.match(fallbackRegExp);
    if (matchFallback && matchFallback[2] && matchFallback[2].length === 11) {
      return matchFallback[2];
    }
    return null;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const isYoutubeSource = (): boolean => {
    if (!lesson?.url) return false;
    const raw = lesson.url.trim();
    return (
      lesson.type === "youtube" ||
      raw.includes("youtube.com") ||
      raw.includes("youtu.be") ||
      raw.startsWith("youtube/")
    );
  };

  const getPlayerSrc = (): string => {
    if (!lesson?.url) return "";
    const raw = lesson.url.trim();
    if (isYoutubeSource()) {
      const id = getYoutubeId(raw);
      if (id) return id;
      // Extract last path segment if valid 11-char ID
      const parts = raw.split('/');
      const lastPart = parts[parts.length - 1].split('?')[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(lastPart)) return lastPart;
      return raw.startsWith("youtube/") ? raw.replace("youtube/", "") : raw;
    }
    return raw;
  };

  const getPosterUrl = (): string => {
    if (!lesson?.url) return "";
    const raw = lesson.url.trim();
    if (isYoutubeSource()) {
      const id = getYoutubeId(raw);
      return id
        ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
        : "";
    }
    return "";
  };

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
  const isQuizType = lType === "quiz" || Boolean((lesson as any).quizId);

  if (isQuizType) {
    return (
      <StudyQuizPlayer
        lesson={lesson}
        onComplete={onComplete}
      />
    );
  }

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
  const isYoutube = isYoutubeSource();

  return (
    <div
      className={styles.playerContainer}
      onContextMenu={handleContextMenu}
    >
      <VidstackPlayer
        src={playerSrc}
        type={isYoutube ? 'youtube' : undefined}
        title={lesson.title}
        poster={posterUrl}
        autoplay={!isYoutube}
      />

      {/* ── Watermark — topmost, no pointer events ─────────────── */}
      <div className={styles.watermarkWrapper}>
        <VideoWatermark />
      </div>
    </div>
  );
}
