import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodesBatch } from '@/lib/media-vault-populator';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // 1. Get all courses in the system
    const courses = await db.query.courses.findMany({
      columns: {
        id: true,
        title: true,
        curriculumJson: true,
      },
    });

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return NextResponse.json({
        totalCourses: 0,
        totalStudents: 0,
        totalEnrollments: 0,
        totalLessonsCompleted: 0,
        courseProgress: [],
        aggregateProgress: 0,
      });
    }

    // 2. Get approved orders for these courses from users with 'student' role
    const allOrdersFlat = await db.query.orders.findMany({
      where: and(
        inArray(schema.orders.courseId, courseIds),
        eq(schema.orders.status, 'approved')
      ),
      columns: {
        id: true,
        userId: true,
        courseId: true,
      },
    });

    // Fetch users separately for MariaDB compatibility
    const orderUserIds = [...new Set(allOrdersFlat.map(o => o.userId))] as string[];
    const orderUsers = orderUserIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, orderUserIds),
          columns: { id: true, role: true },
        })
      : [];
    const orderUserMap = new Map(orderUsers.map(u => [u.id, u]));
    const allOrders = allOrdersFlat.map(o => ({ ...o, user: orderUserMap.get(o.userId) || null }));
    
    const approvedOrders = allOrders.filter(o => o.user?.role === 'student');

    const uniqueStudentIds = new Set(approvedOrders.map(o => o.userId));
    const totalStudents = uniqueStudentIds.size;

    // 3. Get progress entries for these courses (only for students)
    const allProgressFlat = await db.query.lessonProgress.findMany({
      where: inArray(schema.lessonProgress.courseId, courseIds),
      columns: {
        userId: true,
        courseId: true,
        lessonNodeId: true,
      },
    });

    // Fetch users separately for MariaDB compatibility
    const progressUserIds = [...new Set(allProgressFlat.map(p => p.userId))] as string[];
    const progressUsers = progressUserIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(schema.users.id, progressUserIds),
          columns: { id: true, role: true },
        })
      : [];
    const progressUserMap = new Map(progressUsers.map(u => [u.id, u]));
    const allProgressEntries = allProgressFlat.map(p => ({ ...p, user: progressUserMap.get(p.userId) || null }));
    
    const progressEntries = allProgressEntries.filter(p => p.user?.role === 'student');

    // 4. Group data to calculate averages
    const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson as string));
    const populatedCurriculums = await populateMediaVaultNodesBatch(rawCurriculums);

    const courseStats = courses.map((course, index) => {
      const courseOrders = approvedOrders.filter((o) => o.courseId === course.id);
      const enrollmentCount = courseOrders.length;
      
      const curriculum = populatedCurriculums[index];
      const lessonNodes = collectVideoNodes(curriculum);
      const totalLessonsInCourse = lessonNodes.length;

      let avgProgress = 0;
      if (enrollmentCount > 0 && totalLessonsInCourse > 0) {
        // Find progress for each student enrolled in this course
        const studentIds = courseOrders.map(o => o.userId);
        const courseProgressEntries = progressEntries.filter(p => p.courseId === course.id);
        
        let totalPercentageSum = 0;
        studentIds.forEach(sid => {
          const studentProgressCount = courseProgressEntries.filter(p => p.userId === sid).length;
          const studentPercentage = Math.round((studentProgressCount / totalLessonsInCourse) * 100);
          totalPercentageSum += studentPercentage;
        });

        avgProgress = Math.round(totalPercentageSum / enrollmentCount);
      }

      return {
        courseId: course.id,
        courseTitle: course.title,
        enrollmentCount,
        avgProgress,
      };
    });

    const totalEnrollments = approvedOrders.length;
    const totalLessonsCompleted = progressEntries.length;

    // Calculate overall aggregate progress (weighted average)
    let aggregateProgress = 0;
    if (totalEnrollments > 0) {
      const totalProgressSum = courseStats.reduce((sum, cs) => sum + (cs.avgProgress * cs.enrollmentCount), 0);
      aggregateProgress = Math.round(totalProgressSum / totalEnrollments);
    }

    return NextResponse.json({
      totalCourses: courses.length,
      totalStudents,
      totalEnrollments,
      totalLessonsCompleted,
      courseProgress: courseStats,
      aggregateProgress,
    });
  } catch (error: any) {
    console.error('[TEACHER_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
