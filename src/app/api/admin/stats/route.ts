import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthPayload } from '@/lib/route-auth';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const [studentCount, teacherCount, courseCount, totalEnrollments, totalLessonsCompleted] = await Promise.all([
      prisma.user.count({ where: { role: 'student' } }),
      prisma.user.count({ where: { role: 'teacher' } }),
      prisma.course.count({ where: { status: 'published' } }),
      prisma.order.count({ where: { status: 'approved' } }),
      prisma.lessonProgress.count(),
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
