"use client";

import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, type MediaPlayerInstance, SeekButton } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';

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

  // For YouTube sources, Vidstack expects "youtube/{videoId}" format
  const resolvedSrc = type === 'youtube' ? `youtube/${src}` : src;

  const handleAutoPlayFail = () => {
    // If autoplay fails, force player state back to paused so UI syncs with iframe
    if (playerRef.current) {
      playerRef.current.pause();
    }
  };

  // Safety fallback for YouTube state sync:
  // If player gets stuck in playing state while YouTube iframe is blocked/paused, force Vidstack pause to resync UI.
  useEffect(() => {
    if (type !== 'youtube') return;

    let timeoutId: NodeJS.Timeout | null = null;
    const checkSync = () => {
      const player = playerRef.current;
      if (player && player.state.playing && player.state.currentTime === 0) {
        timeoutId = setTimeout(() => {
          if (player.state.playing && player.state.currentTime === 0) {
            player.pause();
          }
        }, 1200);
      }
    };

    const timer = setInterval(checkSync, 1000);
    return () => {
      clearInterval(timer);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [type, resolvedSrc]);

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
        playsInline
        crossOrigin={type === 'youtube' ? undefined : true}
        viewType="video"
        streamType="on-demand"
        logLevel="warn"
        style={{ width: '100%', height: '100%' }}
      >
        <MediaProvider />
        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          slots={{
            beforePlayButton: (
              <SeekButton seconds={-10} className="vds-button" aria-label="Seek backward 10 seconds">
                <SeekBackwardIcon className="vds-icon" />
              </SeekButton>
            ),
            afterPlayButton: (
              <SeekButton seconds={10} className="vds-button" aria-label="Seek forward 10 seconds">
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

