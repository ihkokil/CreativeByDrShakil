'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import '@videojs/react/video/skin.css';
import './VideoPlayer.css';
import { VideoPlayer, VideoSkin } from '@videojs/react/video';
import { HlsJsVideo } from '@videojs/react/media/hlsjs-video';
import { useMedia } from '@videojs/react';
import Hls from 'hls.js';
import VideoWatermark from '@/components/ContentProtection/VideoWatermark';
import { extractPipratubeId, isPipratubeUrl } from '@/lib/pipratube';

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  showWatermark?: boolean;
}

/**
 * Bridge component rendered inside <VideoPlayer> to interface with Hls.js engine and video element.
 * Seamlessly hooks VideoSkin's built-in gear settings menu to Hls.js for immediate level switching.
 */
function HlsEngineBridge({
  videoRef,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const media = useMedia();

  useEffect(() => {
    if (!media) return;

    let isDestroyed = false;
    let boundEngine: Hls | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let boundRenditions: any = null;

    const handleRenditionChange = () => {
      if (!boundRenditions || !boundEngine) return;
      const selectedIndex = boundRenditions.selectedIndex;

      if (selectedIndex === -1) {
        if (boundEngine.manualLevel !== -1) {
          boundEngine.currentLevel = -1;
        }
      } else {
        const domRendition = boundRenditions[selectedIndex];
        const targetId = domRendition?.id !== undefined ? Number(domRendition.id) : selectedIndex;
        if (targetId >= 0 && targetId < boundEngine.levels.length) {
          if (boundEngine.currentLevel !== targetId) {
            boundEngine.currentLevel = targetId;
            boundEngine.loadLevel = targetId;
            boundEngine.nextLevel = targetId;

            // Fast nudge playhead forward to discard stale buffered frames
            const video = videoRef.current;
            if (video && !video.paused) {
              const ct = video.currentTime;
              video.currentTime = ct + 0.001;
            }
          }
        }
      }
    };

    const checkBinding = () => {
      if (isDestroyed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine = (media as any).engine as Hls | null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renditions = (media as any).videoRenditions;

      if (engine && engine !== boundEngine) {
        boundEngine = engine;
      }

      if (renditions && renditions !== boundRenditions) {
        boundRenditions = renditions;
        renditions.addEventListener('change', handleRenditionChange);
      }
    };

    const attachInterval = setInterval(checkBinding, 250);
    checkBinding();

    return () => {
      isDestroyed = true;
      clearInterval(attachInterval);
      if (boundRenditions) {
        boundRenditions.removeEventListener('change', handleRenditionChange);
      }
    };
  }, [media, videoRef]);

  return null;
}

export default function CustomVideoPlayer({
  src,
  poster,
  title,
  autoplay = false,
  showWatermark = true,
}: VideoPlayerProps) {
  const [activeStreamUrl, setActiveStreamUrl] = useState<string>('');
  const [activePoster, setActivePoster] = useState<string | undefined>(poster);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function resolveSource() {
      if (!src) {
        setActiveStreamUrl('');
        return;
      }

      const trimmed = src.trim();

      // If already a direct playlist or stream URL
      if (
        trimmed.startsWith('/api/pipratube/stream') ||
        trimmed.includes('.m3u8')
      ) {
        const abs = trimmed.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${trimmed}`
          : trimmed;
        setActiveStreamUrl(abs);
        if (poster) {
          const absPoster = poster.startsWith('/') && typeof window !== 'undefined'
            ? `${window.location.origin}${poster}`
            : poster;
          setActivePoster(absPoster);
        }
        setIsLoading(false);
        setError(null);
        return;
      }

      // Check if it's a PipraTube URL or video ID
      const pipraId = extractPipratubeId(trimmed);
      if (pipraId || isPipratubeUrl(trimmed)) {
        const targetId = pipraId || trimmed;
        try {
          setIsLoading(true);
          setError(null);
          const res = await fetch(`/api/pipratube/video/${encodeURIComponent(targetId)}`);
          if (!res.ok) {
            throw new Error(`Failed to load PipraTube video (HTTP ${res.status})`);
          }
          const data = await res.json();
          if (!data.success || !data.video?.masterPlaylistUrl) {
            throw new Error(data.error || 'Video stream unavailable');
          }
          if (isMounted) {
            const streamUrl = data.video.masterPlaylistUrl;
            const abs = streamUrl.startsWith('/') && typeof window !== 'undefined'
              ? `${window.location.origin}${streamUrl}`
              : streamUrl;
            setActiveStreamUrl(abs);
            if (!poster && data.video.thumbnailUrl) {
              setActivePoster(data.video.thumbnailUrl);
            }
          }
        } catch (err: unknown) {
          const e = err as Error;
          if (isMounted) setError(e.message);
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      // Fallback: use src directly
      const absSrc = trimmed.startsWith('/') && typeof window !== 'undefined'
        ? `${window.location.origin}${trimmed}`
        : trimmed;
      setActiveStreamUrl(absSrc);
      if (poster) {
        const absPoster = poster.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${poster}`
          : poster;
        setActivePoster(absPoster);
      }
      setIsLoading(false);
      setError(null);
    }

    resolveSource();

    return () => {
      isMounted = false;
    };
  }, [src, poster]);

  // Track video progress for timestamp display
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef]);

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const hlsSource = useMemo(() => {
    return {
      src: activeStreamUrl,
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
  }, [activeStreamUrl]);

  return (
    <div
      className="videojs-player-container w-full h-full overflow-hidden rounded-lg shadow-2xl bg-black ring-1 ring-zinc-800/80 aspect-video flex items-center justify-center relative"
      style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}
    >
      {isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', zIndex: 10 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {error && !isLoading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', color: '#f87171', padding: '20px', textAlign: 'center', zIndex: 10, gap: '12px' }}>
          <p style={{ fontSize: '0.9rem', margin: 0 }}>{error}</p>
          <button
            onClick={() => setActiveStreamUrl(src)}
            style={{ padding: '6px 14px', borderRadius: '6px', background: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {activeStreamUrl && !isLoading && (
        <VideoPlayer title={title} poster={activePoster}>
          <HlsEngineBridge videoRef={videoRef} />
          <VideoSkin
            style={
              {
                '--media-border-radius': '6px',
              } as React.CSSProperties
            }
          >
            <HlsJsVideo
              ref={videoRef}
              key={activeStreamUrl}
              src={activeStreamUrl}
              source={hlsSource}
              poster={activePoster}
              playsInline
              autoPlay={autoplay}
              crossOrigin="anonymous"
              disableRemotePlayback
            />
          </VideoSkin>
        </VideoPlayer>
      )}

      {/* Timestamp overlay — rendered AFTER VideoPlayer so it paints on top of the video element */}
      {activeStreamUrl && !isLoading && duration > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          zIndex: 35,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 6,
          padding: '3px 9px',
          color: '#ffffff',
          fontSize: '0.78rem',
          fontWeight: 600,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          textShadow: '0 1px 0 rgba(0,0,0,0.6)',
        }}>
          <span>{formatTime(currentTime)}</span>
        </div>
      )}

      {/* Watermark overlay on the Video.JS player */}
      {showWatermark && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
          <VideoWatermark />
        </div>
      )}
    </div>
  );
}

