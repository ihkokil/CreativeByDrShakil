import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_CDN_HOST = 'vz-817815b8-518.b-cdn.net';

const MIME_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.mp4': 'video/mp4',
  '.m4s': 'video/iso.segment',
  '.vtt': 'text/vtt',
};

async function handleStreamProxy(
  request: NextRequest,
  paramsPromise: Promise<{ slug: string[] }>,
  isHead: boolean = false
) {
  const { slug } = await paramsPromise;

  if (!slug || slug.length === 0) {
    return new NextResponse('Stream path missing', { status: 400 });
  }

  // Determine target CDN host safely (must end with .b-cdn.net)
  const hostParam = request.nextUrl.searchParams.get('host');
  const targetHost =
    hostParam && (hostParam.endsWith('.b-cdn.net') || hostParam.endsWith('.pipratube.com'))
      ? hostParam
      : DEFAULT_CDN_HOST;

  const relativePath = slug.join('/');
  const targetUrl = `https://${targetHost}/${relativePath}`;

  // Forward Range header if present
  const forwardHeaders: Record<string, string> = {
    'Referer': 'https://pipratube.com/',
    'Origin': 'https://pipratube.com',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  };

  const range = request.headers.get('range');
  if (range) {
    forwardHeaders['Range'] = range;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: isHead ? 'HEAD' : 'GET',
      headers: forwardHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return new NextResponse(`Upstream stream error: ${upstreamRes.statusText}`, {
        status: upstreamRes.status,
      });
    }

    const ext = '.' + (relativePath.split('.').pop()?.toLowerCase() || '');
    const detectedContentType =
      MIME_TYPES[ext] || upstreamRes.headers.get('content-type') || 'application/octet-stream';

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', detectedContentType);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    responseHeaders.set('Accept-Ranges', 'bytes');

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    if (ext === '.m3u8') {
      responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (ext === '.ts') {
      responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      responseHeaders.set('Cache-Control', 'public, max-age=86400');
    }

    if (isHead) {
      return new NextResponse(null, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return new NextResponse(`Stream proxy failed: ${error.message}`, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return handleStreamProxy(request, params, false);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return handleStreamProxy(request, params, true);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

