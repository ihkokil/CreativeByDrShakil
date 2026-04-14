import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireTeacherPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const teacherId = payload.sub;

    // 1. Get all courses for this teacher
    const courses = await prisma.course.findMany({
      where: { teacherId },
      select: {
        id: true,
        title: true,
        curriculumJson: true,
      },
    });

    const courseIds = courses.map((c) => c.id);

    // 2. Get approved orders for these courses from users with 'student' role
    const approvedOrders = await prisma.order.findMany({
      where: {
        courseId: { in: courseIds },
        status: 'approved',
        user: {
          role: 'student'
        }
      },
      select: {
        id: true,
        userId: true,
        courseId: true,
      },
    });

    const uniqueStudentIds = new Set(approvedOrders.map(o => o.userId));
    const totalStudents = uniqueStudentIds.size;

    // 3. Get progress entries for these courses (only for students)
    const progressEntries = await prisma.lessonProgress.findMany({
      where: {
        courseId: { in: courseIds },
        user: {
          role: 'student'
        }
      },
      select: {
        userId: true,
        courseId: true,
        lessonNodeId: true,
      },
    });

    // 4. Group data to calculate averages
    const courseStats = courses.map((course) => {
      const courseOrders = approvedOrders.filter((o) => o.courseId === course.id);
      const enrollmentCount = courseOrders.length;
      
      const lessonNodes = collectVideoNodes(parseCurriculumJson(course.curriculumJson));
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
