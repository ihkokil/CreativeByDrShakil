import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const apiUrl = `https://api.pipratube.com/api/videos/${encodeURIComponent(id)}`;
    const res = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Pipratube API returned status ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    const rawVideo = json?.data?.video;

    if (!rawVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    let resolvedStreamUrl = '';
    const hasHls = !!rawVideo.hlsUrl;
    let baseStreamDir = '';

    const resolutionLinks: {
      hls: Record<string, { url: string; directUrl: string }>;
    } = {
      hls: {},
    };

    if (hasHls) {
      try {
        const parsed = new URL(rawVideo.hlsUrl);
        const streamPath = parsed.pathname.replace(/^\/+/, '');
        // Extract base stream directory (e.g. 40343753-b53d-44ac-ba70-3c77fb4107db)
        baseStreamDir = streamPath.substring(0, streamPath.lastIndexOf('/'));
        const host = parsed.host;
        const hostParam = host !== 'vz-817815b8-518.b-cdn.net' ? `?host=${encodeURIComponent(host)}` : '';
        resolvedStreamUrl = `/api/pipratube/stream/${streamPath}${hostParam}`;

        const levels = ['240p', '360p', '480p', '720p', '1080p'];
        for (const lvl of levels) {
          resolutionLinks.hls[lvl] = {
            url: `/api/pipratube/stream/${baseStreamDir}/${lvl}/video.m3u8${hostParam}`,
            directUrl: `https://${host}/${baseStreamDir}/${lvl}/video.m3u8`,
          };
        }
      } catch {
        resolvedStreamUrl = rawVideo.hlsUrl;
      }
    } else {
      resolvedStreamUrl = rawVideo.hlsUrl || '';
    }

    const availableResolutions = ['240p', '360p', '480p', '720p', '1080p'];

    const videoRecord = {
      id: rawVideo.id,
      title: rawVideo.title || 'Untitled Pipratube Video',
      description: rawVideo.description || '',
      category: rawVideo.category || 'General',
      originalResolution: rawVideo.width && rawVideo.height 
        ? `${rawVideo.width}x${rawVideo.height} (${rawVideo.height}p)` 
        : '1080p Full HD',
      availableResolutions,
      masterPlaylistUrl: resolvedStreamUrl,
      originalHlsUrl: rawVideo.hlsUrl || '',
      resolutions: resolutionLinks,
      createdAt: rawVideo.publishedAt || rawVideo.createdAt || new Date().toISOString(),
      duration: rawVideo.durationSeconds || 0,
      durationFormatted: rawVideo.duration || '0:00',
      thumbnailUrl: rawVideo.thumbnail || '',
      views: rawVideo.views || 0,
      likes: rawVideo.likes || 0,
      channel: rawVideo.channel || null,
      pipratubeUrl: `https://pipratube.com/watch/${rawVideo.id}`,
    };

    return NextResponse.json({
      success: true,
      video: videoRecord,
      raw: rawVideo,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

