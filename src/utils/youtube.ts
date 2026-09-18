/**
 * Utility functions for detecting and extracting YouTube video IDs and thumbnails.
 */

export function extractYoutubeId(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();

  // "youtube/ID" format (used internally by Vidstack)
  if (trimmed.startsWith('youtube/')) {
    const clean = trimmed.replace(/^youtube\//, '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  }

  // Raw 11-char YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Standard or shortened YouTube URLs
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) {
    return match[1];
  }

  // Broad fallback matching
  const fallbackRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|live\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const matchFallback = trimmed.match(fallbackRegExp);
  if (matchFallback && matchFallback[2] && matchFallback[2].length === 11) {
    return matchFallback[2];
  }

  return null;
}

export function isYoutubeSource(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  const trimmed = rawUrl.trim();
  if (
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.startsWith('youtube/')
  ) {
    return true;
  }
  // Check if it matches an 11-character alphanumeric YouTube ID
  return /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
}

export function getYoutubeThumbnail(idOrUrl?: string | null, quality: 'hq' | 'maxres' = 'hq'): string | undefined {
  const id = extractYoutubeId(idOrUrl);
  if (!id) return undefined;
  if (quality === 'maxres') {
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}
