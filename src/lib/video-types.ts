export interface VideoRecord {
  id: string;
  title: string;
  originalResolution: string;
  availableResolutions: string[];
  masterPlaylistUrl: string;
  createdAt: string;
  duration?: number;
  size?: number;
  thumbnailUrl?: string;
}

export interface TranscodeProgress {
  stage: 'idle' | 'uploading' | 'analyzing' | 'transcoding' | 'ready' | 'error';
  progress: number;
  message: string;
  videoId?: string;
  error?: string;
}

export interface ResolutionVariant {
  name: string;
  height: number;
  width: number;
  crf: number;
  maxrate: string;
  bufsize: string;
  bandwidth: number;
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  codec: string;
  size: number;
  fps: number;
  videoBitrate: number; // in kbps
  audioBitrate: number; // in kbps
  hasAudio: boolean;
}
