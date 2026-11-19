'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import '@videojs/react/video/skin.css';
import './VideoPlayer.css';
import { VideoPlayer, VideoSkin, Video } from '@videojs/react/video';
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

/**
 * Handles screen orientation on mobile devices:
 * 1. Automatically requests screen.orientation.lock('landscape') when entering fullscreen (Android Chrome, Samsung Internet, Edge, etc.)
 * 2. Unlocks orientation when exiting fullscreen
 * 3. Fallback for iOS / devices with system orientation lock: applies data-portrait-fullscreen so CSS rotates 90deg to fill the screen
 * 4. Fallback for iPhone Safari: invokes webkitEnterFullscreen on video element if container fullscreen is unsupported
 */
function useFullscreenOrientation(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  useEffect(() => {
    const lockLandscape = async () => {
      try {
        const orientation = window.screen?.orientation as any;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
        } else if ((window.screen as any)?.lockOrientation) {
          (window.screen as any).lockOrientation('landscape');
        } else if ((window.screen as any)?.mozLockOrientation) {
          (window.screen as any).mozLockOrientation('landscape');
        } else if ((window.screen as any)?.msLockOrientation) {
          (window.screen as any).msLockOrientation('landscape');
        }
      } catch {
        // Ignored if unsupported or user has system orientation lock
      }
    };

    const unlockOrientation = () => {
      try {
        const orientation = window.screen?.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        } else if ((window.screen as any)?.unlockOrientation) {
          (window.screen as any).unlockOrientation();
        } else if ((window.screen as any)?.mozUnlockOrientation) {
          (window.screen as any).mozUnlockOrientation();
        } else if ((window.screen as any)?.msUnlockOrientation) {
          (window.screen as any).msUnlockOrientation();
        }
      } catch {
        // Ignored
      }
    };

    const updateOrientationState = () => {
      const fsElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      const isFs = Boolean(fsElement);
      const isPortrait = window.innerHeight > window.innerWidth;

      if (isFs) {
        lockLandscape();
        if (isPortrait) {
          if (fsElement) fsElement.setAttribute('data-portrait-fullscreen', 'true');
          if (containerRef.current) containerRef.current.setAttribute('data-portrait-fullscreen', 'true');
        } else {
          if (fsElement) fsElement.removeAttribute('data-portrait-fullscreen');
          if (containerRef.current) containerRef.current.removeAttribute('data-portrait-fullscreen');
        }
      } else {
        unlockOrientation();
        if (fsElement) fsElement.removeAttribute('data-portrait-fullscreen');
        if (containerRef.current) containerRef.current.removeAttribute('data-portrait-fullscreen');
        document.querySelectorAll('[data-portrait-fullscreen="true"]').forEach((el) => {
          el.removeAttribute('data-portrait-fullscreen');
        });
      }
    };

    const handlePointerUp = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const fsButton = target.closest(
        '.media-fullscreen-button, [data-fullscreen-button], button[aria-label*="fullscreen" i]'
      );
      if (fsButton) {
        const isFs = Boolean(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement
        );
        if (!isFs) {
          lockLandscape();

          // iPhone fallback: on iPhone Safari, container requestFullscreen is unsupported; invoke webkitEnterFullscreen on <video>
          const isIPhone = /iPhone|iPod/i.test(navigator.userAgent);
          if (
            isIPhone &&
            videoRef.current &&
            typeof (videoRef.current as any).webkitEnterFullscreen === 'function' &&
            !document.fullscreenEnabled &&
            !(document as any).webkitFullscreenEnabled
          ) {
            try {
              (videoRef.current as any).webkitEnterFullscreen();
            } catch {
              // Ignore
            }
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handlePointerUp, { capture: true });
    }

    document.addEventListener('fullscreenchange', updateOrientationState);
    document.addEventListener('webkitfullscreenchange', updateOrientationState);
    document.addEventListener('mozfullscreenchange', updateOrientationState);
    document.addEventListener('MSFullscreenChange', updateOrientationState);
    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', updateOrientationState);

    return () => {
      if (container) {
        container.removeEventListener('click', handlePointerUp, { capture: true });
      }
      document.removeEventListener('fullscreenchange', updateOrientationState);
      document.removeEventListener('webkitfullscreenchange', updateOrientationState);
      document.removeEventListener('mozfullscreenchange', updateOrientationState);
      document.removeEventListener('MSFullscreenChange', updateOrientationState);
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', updateOrientationState);
    };
  }, [containerRef, videoRef]);
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
  const [retryNonce, setRetryNonce] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useFullscreenOrientation(containerRef, videoRef);

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
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.error || `Failed to load PipraTube video (HTTP ${res.status})`);
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
  }, [src, poster, retryNonce]);

  const isHls = Boolean(
    activeStreamUrl &&
      (activeStreamUrl.includes('.m3u8') || activeStreamUrl.includes('/hls/'))
  );

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
      ref={containerRef}
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
            onClick={() => setRetryNonce((c) => c + 1)}
            style={{ padding: '6px 14px', borderRadius: '6px', background: '#27272a', color: '#f4f4f5', border: '1px solid #3f3f46', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Retry
          </button>
        </div>
      )}

      {activeStreamUrl && !isLoading && (
        <VideoPlayer title={title} poster={activePoster}>
          {isHls ? (
            <>
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
                {showWatermark && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
                    <VideoWatermark />
                  </div>
                )}
              </VideoSkin>
            </>
          ) : (
            <VideoSkin
              style={
                {
                  '--media-border-radius': '6px',
                } as React.CSSProperties
              }
            >
              <Video
                ref={videoRef}
                key={activeStreamUrl}
                src={activeStreamUrl}
                poster={activePoster}
                playsInline
                autoPlay={autoplay}
                crossOrigin="anonymous"
                disableRemotePlayback
              />
              {showWatermark && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
                  <VideoWatermark />
                </div>
              )}
            </VideoSkin>
          )}
        </VideoPlayer>
      )}
    </div>
  );
}

