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
  channel?: {
    id?: string;
    name?: string;
    handle?: string;
    avatar?: string;
    verified?: boolean;
    subscriberCount?: number;
  };
  category?: string;
  views?: number;
  likes?: number;
  durationFormatted?: string;
  pipratubeUrl?: string;
  originalHlsUrl?: string;
  resolutions?: {
    hls: Record<string, { url: string; directUrl: string }>;
  };
}

/**
 * Checks whether a given URL or identifier belongs to PipraTube.
 */
export function isPipratubeUrl(rawUrl: string | null | undefined): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (
    trimmed.includes("pipratube.com") ||
    trimmed.startsWith("pipratube/") ||
    trimmed.includes("/api/pipratube/") ||
    trimmed.includes("b-cdn.net")
  ) {
    return true;
  }
  // Check if string is a 24-character hexadecimal ObjectId (PipraTube ID format)
  // or a UUID (not matching standard 11-char YouTube ID)
  if (/^[a-f0-9]{24}$/i.test(trimmed)) {
    return true;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Extracts the video ID from a PipraTube URL or identifier.
 */
export function extractPipratubeId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();

  // If already clean ID (24-hex ObjectId or 36-char UUID)
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return trimmed;

  if (trimmed.startsWith("pipratube/")) {
    return trimmed.replace("pipratube/", "").trim();
  }

  // URL matching: watch/:id, video/:id, embed/:id, watch?v=:id
  const match = trimmed.match(
    /pipratube\.com\/(?:watch\/(?:[^\/\?]+\/)?|video\/|embed\/|watch\?.*v=)([a-zA-Z0-9_-]+)/i
  );
  if (match && match[1]) {
    return match[1];
  }

  // Path ending with valid PipraTube ID
  try {
    const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const parts = urlObj.pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (
      lastPart &&
      (/^[a-f0-9]{24}$/i.test(lastPart) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastPart))
    ) {
      return lastPart;
    }
  } catch {
    // Ignore invalid URL parse
  }

  return null;
}

/**
 * Detects whether the input URL is YouTube or PipraTube.
 */
export function detectVideoPlatform(
  rawUrl: string | null | undefined
): 'pipratube' | 'youtube' | 'direct' | 'unknown' {
  if (!rawUrl) return 'unknown';
  if (isPipratubeUrl(rawUrl)) return 'pipratube';
  const trimmed = rawUrl.trim();
  if (
    trimmed.includes("youtube.com") ||
    trimmed.includes("youtu.be") ||
    trimmed.startsWith("youtube/") ||
    /^[a-zA-Z0-9_-]{11}$/.test(trimmed)
  ) {
    return 'youtube';
  }
  if (trimmed.endsWith('.m3u8') || trimmed.endsWith('.mp4') || trimmed.endsWith('.webm')) {
    return 'direct';
  }
  return 'unknown';
}

