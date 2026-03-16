import React, { useRef, useEffect } from 'react';

interface SecureYouTubePlayerProps {
  videoId: string;
  width?: string | number;
  height?: string | number;
}

const SecureYouTubePlayer: React.FC<SecureYouTubePlayerProps> = ({ videoId, width = '100%', height = 400 }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preventContextMenu = (e: Event) => e.preventDefault();
    const preventClick = (e: Event) => e.stopPropagation();
    const overlay = containerRef.current?.querySelector('.yt-overlay');
    if (overlay) {
      overlay.addEventListener('contextmenu', preventContextMenu);
      overlay.addEventListener('click', preventClick);
    }
    return () => {
      if (overlay) {
        overlay.removeEventListener('contextmenu', preventContextMenu);
        overlay.removeEventListener('click', preventClick);
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width, height }}>
      <iframe
        width={width}
        height={height}
        src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&controls=1&disablekb=1&fs=0`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen={false}
        style={{ pointerEvents: 'none' }}
      />
      <div
        className="yt-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'default',
          zIndex: 2,
        }}
      />
    </div>
  );
};

export default SecureYouTubePlayer;
