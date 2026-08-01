"use client";

import { MediaPlayer, MediaProvider } from '@vidstack/react';
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
  // For YouTube sources, Vidstack expects "youtube/{videoId}" format
  const resolvedSrc = type === 'youtube' ? `youtube/${src}` : src;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MediaPlayer
        key={resolvedSrc}
        src={resolvedSrc}
        title={title}
        poster={poster}
        autoPlay={autoplay}
        playsInline
        crossOrigin
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
