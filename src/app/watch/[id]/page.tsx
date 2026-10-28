'use client';

import React, { useState, useEffect, use } from 'react';
import VideoPlayer from '@/components/VideoPlayer';
import { VideoRecord } from '@/lib/pipratube';

export default function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadVideo() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/pipratube/video/${encodeURIComponent(id)}`);
        if (!res.ok) {
          throw new Error(`Failed to load video (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (data.success && data.video) {
          if (isMounted) setVideo(data.video);
        } else {
          throw new Error(data.error || 'Video data unavailable');
        }
      } catch (err: unknown) {
        const e = err as Error;
        if (isMounted) setError(e.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (id) {
      loadVideo();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '1000px' }}>
        {isLoading && (
          <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: '8px', backgroundColor: '#09090b', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #27272a' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {error && !isLoading && (
          <div style={{ aspectRatio: '16/9', width: '100%', borderRadius: '8px', backgroundColor: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '1px solid #27272a', textAlign: 'center', padding: '1.5rem', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#f87171' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '6px 14px', borderRadius: '6px', backgroundColor: '#27272a', color: '#e4e4e7', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid #3f3f46' }}
            >
              Retry
            </button>
          </div>
        )}

        {video && !isLoading && (
          <VideoPlayer
            src={video.masterPlaylistUrl}
            poster={video.thumbnailUrl}
            title={video.title}
            autoplay={false}
          />
        )}
      </div>
    </main>
  );
}

