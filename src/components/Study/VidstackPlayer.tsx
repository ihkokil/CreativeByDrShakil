"use client";

import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, type MediaPlayerInstance, SeekButton } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import './VidstackPlayer.css';

export interface VidstackPlayerProps {
  src: string;
  type?: string;
  title?: string;
  poster?: string;
  autoplay?: boolean;
}

/**
 * Vidstack-based video player with built-in YouTube support.
 *
 * For YouTube videos, pass the video ID as `src` and set `type` to "youtube".
 * For self-hosted videos, pass the direct URL as `src`.
 */
export default function VidstackPlayer({
  src,
  type,
  title,
  poster,
  autoplay = false,
}: VidstackPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const userAgentMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
        const touchMobile = 'ontouchstart' in window && window.innerWidth <= 1024;
        setIsMobile(userAgentMobile || touchMobile);
      }
    };
    checkMobile();
  }, []);

  // YouTube embeds block unmuted autoplay on both desktop and mobile browsers on initial load.
  // Setting autoPlay=true on YouTube embeds causes Vidstack state desync (shows pause icon while YT stays paused).
  const shouldAutoPlay = type === 'youtube' ? false : (isMobile ? false : autoplay);

  const resolvedSrc = type === 'youtube' ? `youtube/${src}` : src;
  const storageKey = `cbds_vidstack_pos_${encodeURIComponent(resolvedSrc)}`;
  const hasResumedRef = useRef(false);
  const lastSaveTimeRef = useRef(0);

  const handleCanPlay = () => {
    if (!playerRef.current) return;
    try {
      const savedSpeed = localStorage.getItem('preferred_playback_speed');
      if (savedSpeed) {
        const rate = parseFloat(savedSpeed);
        if (!isNaN(rate) && rate >= 0.5 && rate <= 2.5) {
          playerRef.current.playbackRate = rate;
        }
      }
      // For non-YouTube direct videos, restoring position on canplay is safe
      if (type !== 'youtube' && !hasResumedRef.current) {
        const savedPos = localStorage.getItem(storageKey);
        if (savedPos) {
          const pos = parseFloat(savedPos);
          const duration = playerRef.current.duration;
          if (!isNaN(pos) && pos > 5 && (!duration || pos < duration - 10)) {
            playerRef.current.currentTime = pos;
            hasResumedRef.current = true;
          }
        }
      }
    } catch {}
  };

  // For YouTube embeds, only restore timestamp once user gesture triggers play.
  // Calling seekTo before initial user gesture puts YouTube in an infinite BUFFERING state.
  const handlePlay = () => {
    if (hasResumedRef.current || !playerRef.current) return;
    try {
      const savedPos = localStorage.getItem(storageKey);
      if (savedPos) {
        const pos = parseFloat(savedPos);
        const duration = playerRef.current.duration;
        if (!isNaN(pos) && pos > 5 && (!duration || pos < duration - 10)) {
          playerRef.current.currentTime = pos;
          hasResumedRef.current = true;
        }
      }
    } catch {}
  };

  const handleSeeked = () => {
    // If student scrubs/taps the sleek slider while YouTube is paused/cued,
    // trigger playback so YouTube accepts the seek without stalling
    if (type === 'youtube' && playerRef.current?.paused) {
      playerRef.current.play().catch(() => {});
    }
  };

  const handleTimeUpdate = (detail: any) => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 2500) return;
    lastSaveTimeRef.current = now;
    const currentTime = detail?.currentTime ?? playerRef.current?.currentTime;
    const duration = detail?.duration ?? playerRef.current?.duration;
    try {
      if (duration && currentTime >= duration - 10) {
        localStorage.removeItem(storageKey);
      } else if (currentTime > 5) {
        localStorage.setItem(storageKey, String(Math.floor(currentTime)));
      }
    } catch {}
  };

  const handleRateChange = (detail: any) => {
    const rate = detail?.playbackRate ?? playerRef.current?.playbackRate;
    try {
      if (rate) {
        localStorage.setItem('preferred_playback_speed', String(rate));
      }
    } catch {}
  };

  const handleAutoPlayFail = () => {
    // If autoplay fails, force player state back to paused so UI syncs with iframe
    if (playerRef.current) {
      playerRef.current.pause();
    }
  };

  const SeekBackwardIcon = defaultLayoutIcons.SeekButton.Backward;
  const SeekForwardIcon = defaultLayoutIcons.SeekButton.Forward;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MediaPlayer
        ref={playerRef}
        key={resolvedSrc}
        src={resolvedSrc}
        title={title}
        poster={poster}
        autoPlay={shouldAutoPlay}
        onAutoPlayFail={handleAutoPlayFail}
        onCanPlay={handleCanPlay}
        onPlay={handlePlay}
        onSeeked={handleSeeked}
        onTimeUpdate={handleTimeUpdate}
        onRateChange={handleRateChange}
        playsInline
        crossOrigin={type === 'youtube' ? undefined : true}
        viewType="video"
        streamType="on-demand"
        logLevel="warn"
        style={{ width: '100%', height: '100%' }}
      >
        <MediaProvider
          iframeProps={{
            allow:
              'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowFullScreen: true,
            referrerPolicy: 'strict-origin-when-cross-origin',
          }}
        />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          slots={{
            beforePlayButton: (
              <SeekButton seconds={-10} className="vds-button vds-seek-button vds-seek-backward" aria-label="Seek backward 10 seconds">
                <SeekBackwardIcon className="vds-icon" />
              </SeekButton>
            ),
            afterPlayButton: (
              <SeekButton seconds={10} className="vds-button vds-seek-button vds-seek-forward" aria-label="Seek forward 10 seconds">
                <SeekForwardIcon className="vds-icon" />
              </SeekButton>
            ),
          }}
        />
      </MediaPlayer>

      {/* Overlay to block YouTube branding clicks and right-click */}
      {type === 'youtube' && (
        <div
          className="vidstack-yt-overlay"
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0,
            pointerEvents: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />
      )}
    </div>
  );
}


