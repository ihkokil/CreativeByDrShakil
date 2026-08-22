import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchPublishedCoursesServer } from '@/lib/server-courses';

export async function GET() {
  try {
    const courses = await fetchPublishedCoursesServer();

    return NextResponse.json(
      { courses },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error: any) {
    console.error('[Courses Dynamic Error]', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Failed to load courses. Please try again.' },
      { status: 500 }
    );
  }
}
