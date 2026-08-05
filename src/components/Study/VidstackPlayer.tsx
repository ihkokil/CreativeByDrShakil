"use client";

import { useEffect, useRef, useState } from 'react';
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react';
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

  // On mobile devices, YouTube embeds block unmuted autoplay.
  // Setting autoPlay=true on mobile causes Vidstack state desync (shows pause icon while YT stays paused).
  const shouldAutoPlay = isMobile ? false : autoplay;

  // For YouTube sources, Vidstack expects "youtube/{videoId}" format
  const resolvedSrc = type === 'youtube' ? `youtube/${src}` : src;

  const handleAutoPlayFail = () => {
    // If autoplay fails, force player state back to paused so UI syncs with iframe
    if (playerRef.current) {
      playerRef.current.pause();
    }
  };

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
        <DefaultVideoLayout icons={defaultLayoutIcons} />
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

