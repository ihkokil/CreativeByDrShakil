import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course } from '@/db/schema';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Optional CRON_SECRET security token check
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET?.trim();

    if (cronSecret) {
      const expectedToken = `Bearer ${cronSecret}`;
      const urlToken = new URL(request.url).searchParams.get('token');

      if (authHeader !== expectedToken && urlToken !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Run a fast, lightweight query to warm up the serverless database instance
    const result = await db.select({ id: course.id }).from(course).limit(1);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      warmed: result.length > 0 ? result[0].id : 'no_courses',
    });
  } catch (error: any) {
    console.error('[Cron Keep-Warm] Error warming database:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
