import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import ytdl from '@distube/ytdl-core';

export async function GET(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = verifyAuthToken(token);
    if (payload.role !== 'admin' && payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL is required.' }, { status: 400 });
    }

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        const info = await ytdl.getInfo(url);
        return NextResponse.json({
          title: info.videoDetails.title,
          duration: Number(info.videoDetails.lengthSeconds),
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to fetch YouTube info.' }, { status: 400 });
      }
    } else if (url.includes('vimeo.com')) {
      try {
        const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Vimeo API failed');
        const data = await res.json();
        return NextResponse.json({
          title: data.title || '',
          duration: Number(data.duration) || 0,
        });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to fetch Vimeo info.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Unsupported URL platform.' }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
