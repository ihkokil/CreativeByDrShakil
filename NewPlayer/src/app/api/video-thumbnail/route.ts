import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const videoUrl = request.nextUrl.searchParams.get('videoUrl');

  if (!videoUrl) {
    return new Response('Missing videoUrl parameter', { status: 400 });
  }

  const youtubeMatch = videoUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );

  if (youtubeMatch) {
    const id = youtubeMatch[1];
    const thumbnailUrl = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
    const res = await fetch(thumbnailUrl);
    if (!res.ok) {
      const fallbackUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      const fallbackRes = await fetch(fallbackUrl);
      const buffer = await fallbackRes.arrayBuffer();
      return new Response(buffer, {
        headers: {
          'Content-Type': fallbackRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);

  if (vimeoMatch) {
    const id = vimeoMatch[1];
    const oembedRes = await fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${id}`
    );
    const oembed = await oembedRes.json();
    if (oembed.thumbnail_url) {
      const imgRes = await fetch(oembed.thumbnail_url);
      const buffer = await imgRes.arrayBuffer();
      return new Response(buffer, {
        headers: {
          'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }
  }

  const filename = videoUrl.split('/').pop()?.split('.')[0] || 'Video';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
    <rect width="1280" height="720" fill="#1f2937"/>
    <text x="640" y="360" font-family="system-ui, sans-serif" font-size="48" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">${filename}</text>
  </svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
