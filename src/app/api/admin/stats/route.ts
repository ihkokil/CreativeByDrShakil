import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { getAuthPayload } from '@/lib/route-auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const [
      studentCountRes,
      teacherCountRes,
      courseCountRes,
      totalEnrollmentsRes,
      totalLessonsCompletedRes
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, 'student')),
      db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, 'teacher')),
      db.select({ count: sql<number>`count(*)` }).from(schema.courses).where(eq(schema.courses.status, 'published')),
      db.select({ count: sql<number>`count(*)` }).from(schema.orders).where(eq(schema.orders.status, 'approved')),
      db.select({ count: sql<number>`count(*)` }).from(schema.lessonProgress),
    ]);

    const studentCount = Number(studentCountRes[0].count);
    const teacherCount = Number(teacherCountRes[0].count);
    const courseCount = Number(courseCountRes[0].count);
    const totalEnrollments = Number(totalEnrollmentsRes[0].count);
    const totalLessonsCompleted = Number(totalLessonsCompletedRes[0].count);

    return NextResponse.json({
      studentCount,
      teacherCount,
      courseCount,
      totalEnrollments,
      totalLessonsCompleted,
    });
  } catch (error: any) {
    console.error('[ADMIN_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
