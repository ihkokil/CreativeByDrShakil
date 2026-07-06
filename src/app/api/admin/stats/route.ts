import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userSchema, course as courseSchema, order as orderSchema, lessonProgress as lessonProgressSchema } from '@/db/schema';
import { count, eq } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const [
      [{ count: studentCount }],
      [{ count: teacherCount }],
      [{ count: courseCount }],
      [{ count: totalEnrollments }],
      [{ count: totalLessonsCompleted }]
    ] = await Promise.all([
      db.select({ count: count() }).from(userSchema).where(eq(userSchema.role, 'student')),
      db.select({ count: count() }).from(userSchema).where(eq(userSchema.role, 'teacher')),
      db.select({ count: count() }).from(courseSchema).where(eq(courseSchema.status, 'published')),
      db.select({ count: count() }).from(orderSchema).where(eq(orderSchema.status, 'approved')),
      db.select({ count: count() }).from(lessonProgressSchema),
    ]);

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
