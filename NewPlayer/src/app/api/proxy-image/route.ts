import { NextRequest } from 'next/server';

const ALLOWED_DOMAINS = [
  'img.youtube.com',
  'i.vimeocdn.com',
  'i.ytimg.com',
  'vimeo.com',
  '2minutecoding.com',
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const parsed = new URL(url);

    if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
      return new Response('Domain not allowed', { status: 403 });
    }

    const res = await fetch(url);

    if (!res.ok) {
      return new Response('Failed to fetch image', { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Failed to proxy image', { status: 500 });
  }
}
