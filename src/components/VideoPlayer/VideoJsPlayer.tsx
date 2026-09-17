'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VideoPlayer, VideoSkin, Video } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { useMedia } from '@videojs/react';
import Hls from 'hls.js';
import './VideoJsPlayer.css';

export interface VideoJsPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  onEnded?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Bridge component rendered inside <VideoPlayer> to interface with Hls.js engine and video element:
 * 1. Handles quality selection from the gear menu and maps it to Hls.js level switching.
 * 2. Connects native video events (ended, timeupdate).
 */
function HlsEngineBridge({
  videoRef,
  onEnded,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEnded?: () => void;
}) {
  const media = useMedia();

  useEffect(() => {
    if (!media) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = (media as any).engine as Hls | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renditions = (media as any).videoRenditions;

    // Handle manual vs auto quality selection from player menu
    const handleRenditionChange = () => {
      if (!renditions || !engine) return;
      const selectedIndex = renditions.selectedIndex;

      if (selectedIndex === -1) {
        // Auto (ABR) selected
        if (engine.manualLevel !== -1) {
          engine.currentLevel = -1;
        }
      } else if (selectedIndex >= 0 && selectedIndex < engine.levels.length) {
        // Specific manual rendition selected
        if (engine.currentLevel !== selectedIndex) {
          engine.currentLevel = selectedIndex;
        }
      }
    };

    if (renditions) {
      renditions.addEventListener('change', handleRenditionChange);
    }

    const video = videoRef.current;
    const handleEnded = () => {
      if (onEnded) onEnded();
    };

    if (video) {
      video.addEventListener('ended', handleEnded);
    }

    return () => {
      if (renditions) {
        renditions.removeEventListener('change', handleRenditionChange);
      }
      if (video) {
        video.removeEventListener('ended', handleEnded);
      }
    };
  }, [media, videoRef, onEnded]);

  return null;
}

export default function VideoJsPlayer({
  src,
  poster,
  title,
  autoplay = false,
  onEnded,
  className = '',
  style = {},
}: VideoJsPlayerProps) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [resolvedPoster, setResolvedPoster] = useState(poster);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const absSrc = src?.startsWith('/') ? `${window.location.origin}${src}` : src;
      setResolvedSrc(absSrc);

      if (poster) {
        const absPoster = poster.startsWith('/') ? `${window.location.origin}${poster}` : poster;
        setResolvedPoster(absPoster);
      } else {
        setResolvedPoster(undefined);
      }
    }
  }, [src, poster]);

  const isHls = Boolean(src && (src.includes('.m3u8') || src.includes('/master')));

  // Source configuration for HlsJsVideo
  const hlsSource = useMemo(() => {
    if (!isHls) return null;
    return {
      src: resolvedSrc,
      preferPlayback: 'mse' as const,
      capRenditionToPlayerSize: false,
      engine: {
        hlsJs: {
          maxBufferLength: 8,
          maxMaxBufferLength: 16,
          backBufferLength: 0,
        },
      },
    };
  }, [isHls, resolvedSrc]);

  return (
    <div
      className={`vjs-player-wrapper ${className}`}
      style={style}
      onContextMenu={(e) => e.preventDefault()}
    >
      <VideoPlayer title={title} poster={resolvedPoster}>
        {isHls && (
          <HlsEngineBridge
            videoRef={videoRef}
            onEnded={onEnded}
          />
        )}
        <VideoSkin>
          {isHls ? (
            <HlsJsVideo
              ref={videoRef}
              key={resolvedSrc}
              src={resolvedSrc}
              source={hlsSource}
              poster={resolvedPoster}
              autoPlay={autoplay}
              playsInline
              crossOrigin="anonymous"
            />
          ) : (
            <Video
              ref={videoRef}
              key={resolvedSrc}
              src={resolvedSrc}
              poster={resolvedPoster}
              autoPlay={autoplay}
              playsInline
              crossOrigin="anonymous"
              onEnded={onEnded}
            />
          )}
        </VideoSkin>
      </VideoPlayer>
    </div>
  );
}
