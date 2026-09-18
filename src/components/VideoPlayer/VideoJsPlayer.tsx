'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import '@videojs/react/video/skin.css';
import { VideoPlayer, VideoSkin, Video } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { SeekButton } from '@videojs/react';
import { SeekIcon } from '@videojs/react/icons';
import VidstackPlayer from '@/components/Study/VidstackPlayer';
import { extractYoutubeId, isYoutubeSource, getYoutubeThumbnail } from '@/utils/youtube';
import './VideoJsPlayer.css';

export { extractYoutubeId, isYoutubeSource, getYoutubeThumbnail };

export interface VideoJsPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  onEnded?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function VideoJsPlayer({
  src,
  poster,
  title,
  autoplay = true,
  onEnded,
  className = '',
  style = {},
}: VideoJsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wasAutoMutedRef = useRef(false);
  const [controlsEl, setControlsEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const findControls = () => {
      const el = containerRef.current?.querySelector('.video-controls-primary') as HTMLElement | null;
      if (el) {
        setControlsEl(el);
        return true;
      }
      return false;
    };

    if (!findControls()) {
      const observer = new MutationObserver(() => {
        if (findControls()) {
          observer.disconnect();
        }
      });
      observer.observe(containerRef.current, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, []);

  // Resolve relative URLs to absolute (SSR safe)
  const resolvedSrc = useMemo(() => {
    if (!src) return '';
    if (src.startsWith('/') && typeof window !== 'undefined') {
      return `${window.location.origin}${src}`;
    }
    return src;
  }, [src]);

  const resolvedPoster = useMemo(() => {
    if (!poster) return undefined;
    if (poster.startsWith('/') && typeof window !== 'undefined') {
      return `${window.location.origin}${poster}`;
    }
    return poster;
  }, [poster]);

  const isYoutube = useMemo(() => {
    return isYoutubeSource(resolvedSrc);
  }, [resolvedSrc]);

  const isHls = useMemo(() => {
    if (!resolvedSrc || isYoutube) return false;
    const clean = resolvedSrc.split('?')[0].toLowerCase();
    if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.ogg')) {
      return false;
    }
    return (
      clean.endsWith('.m3u8') ||
      clean.includes('.m3u8') ||
      clean.includes('/master')
    );
  }, [resolvedSrc, isYoutube]);

  // Attempt autoplay safely with browser policy fallback
  const attemptAutoplay = useCallback((video: HTMLVideoElement | null) => {
    if (!autoplay || !video) return;
    if (!video.paused) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch((error: any) => {
        // Browser blocked unmuted autoplay due to policy
        if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
          video.muted = true;
          wasAutoMutedRef.current = true;
          video.play().catch(() => {
            // Both blocked (e.g. low-power mode)
          });
        }
      });
    }
  }, [autoplay]);

  const handleCanPlay = useCallback(() => {
    const video = videoRef.current || containerRef.current?.querySelector('video');
    if (video && video.paused) {
      attemptAutoplay(video);
    }
  }, [attemptAutoplay]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current || containerRef.current?.querySelector('video');
    if (video && video.paused) {
      attemptAutoplay(video);
    }
  }, [attemptAutoplay]);

  // Hook into video element events and src changes for autoplay
  useEffect(() => {
    if (!autoplay || !resolvedSrc) return;

    const video = videoRef.current || containerRef.current?.querySelector('video');
    if (!video) return;

    if (video.readyState >= 2 && video.paused) {
      attemptAutoplay(video);
    }

    const onCanPlay = () => {
      if (video.paused) attemptAutoplay(video);
    };

    const onLoadedMetadata = () => {
      if (video.paused) attemptAutoplay(video);
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [resolvedSrc, autoplay, attemptAutoplay]);

  // If video was auto-muted due to browser restrictions, restore unmuted on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      if (wasAutoMutedRef.current) {
        wasAutoMutedRef.current = false;
        const video = videoRef.current || containerRef.current?.querySelector('video');
        if (video && video.muted) {
          try {
            video.muted = false;
          } catch {
            // Ignore any restriction
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('pointerdown', handleInteraction, { capture: true, once: true });
    }

    return () => {
      if (container) {
        container.removeEventListener('pointerdown', handleInteraction, { capture: true });
      }
    };
  }, [resolvedSrc]);

  if (!resolvedSrc) {
    return (
      <div className={`video-player-container ${className}`} style={style}>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No video stream specified
        </div>
      </div>
    );
  }

  if (isYoutube) {
    const ytId = extractYoutubeId(resolvedSrc) || resolvedSrc;
    const ytPoster = resolvedPoster || getYoutubeThumbnail(ytId, 'maxres') || getYoutubeThumbnail(ytId, 'hq');
    return (
      <div
        className={`video-player-container ${className}`}
        style={style}
        onContextMenu={(e) => e.preventDefault()}
        title={title}
      >
        <VidstackPlayer
          src={ytId}
          type="youtube"
          title={title}
          poster={ytPoster}
          autoplay={autoplay}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`video-player-container ${className}`}
      style={style}
      onContextMenu={(e) => e.preventDefault()}
      title={title}
    >
      <VideoPlayer>
        <VideoSkin className="absolute inset-0">
          {isHls ? (
            <HlsJsVideo
              key={resolvedSrc}
              ref={videoRef}
              src={resolvedSrc}
              poster={resolvedPoster}
              playsInline
              autoPlay={autoplay}
              crossOrigin="anonymous"
              preload="auto"
              onCanPlay={handleCanPlay}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={onEnded}
            />
          ) : (
            <Video
              key={resolvedSrc}
              ref={videoRef}
              src={resolvedSrc}
              poster={resolvedPoster}
              playsInline
              autoPlay={autoplay}
              crossOrigin="anonymous"
              preload="auto"
              onCanPlay={handleCanPlay}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={onEnded}
            />
          )}
          {controlsEl &&
            createPortal(
              <>
                <SeekButton
                  seconds={-10}
                  className="media-button media-seek-button media-seek-backward-button"
                  title="Rewind 10 seconds"
                  aria-label="Seek backward 10 seconds"
                >
                  <div className="media-seek-button-content">
                    <SeekIcon className="media-button-icon media-seek-button-backward-icon" />
                    <span className="media-seek-button-label media-seek-button-backward-label">10</span>
                  </div>
                </SeekButton>
                <SeekButton
                  seconds={10}
                  className="media-button media-seek-button media-seek-forward-button"
                  title="Forward 10 seconds"
                  aria-label="Seek forward 10 seconds"
                >
                  <div className="media-seek-button-content">
                    <SeekIcon className="media-button-icon media-seek-button-forward-icon" />
                    <span className="media-seek-button-label media-seek-button-forward-label">10</span>
                  </div>
                </SeekButton>
              </>,
              controlsEl
            )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
}
