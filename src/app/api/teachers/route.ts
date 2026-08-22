import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchPublishedTeachersServer } from '@/lib/server-courses';

export async function GET() {
  try {
    const teachers = await fetchPublishedTeachersServer();

    return NextResponse.json(
      { teachers },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    console.error('[/api/teachers] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}