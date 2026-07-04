import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseCurriculumJson, collectVideoNodes } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

/**
 * GET /api/students/[id]/progress
 * Returns a map of courseId -> progressPercent for all courses the student is enrolled in.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: studentId } = await params;

    // 1. Find approved enrollments for this student
    const enrollments = await db.order.findMany({
      where: {
        userId: studentId,
        status: 'approved'
      },
      select: { 
        courseId: true,
        course: {
          select: { id: true, curriculumJson: true },
        }
      },
    });

    if (enrollments.length === 0) {
      return NextResponse.json({ progress: {} });
    }

    const courseIds = enrollments.map(e => e.courseId);

    // 2. Fetch all lesson progress for this student in these courses
    let progressRows: { courseId: string; lessonNodeId: string }[] = [];
    try {
      progressRows = await db.lessonProgress.findMany({
        where: {
          userId: studentId,
          courseId: { in: courseIds }
        },
        select: { courseId: true, lessonNodeId: true },
      });
    } catch (err) {
      console.warn('LessonProgress query failed', err);
    }

    // 3. Group completed nodes by courseId
    const completedByCourse: Record<string, Set<string>> = {};
    for (const row of progressRows) {
      if (!completedByCourse[row.courseId]) {
        completedByCourse[row.courseId] = new Set();
      }
      completedByCourse[row.courseId].add(row.lessonNodeId);
    }

    // 4. Calculate progress for each course
    const progressMap: Record<string, number> = {};

    for (const enrollment of enrollments) {
      const courseId = enrollment.courseId;
      const rawCurriculum = parseCurriculumJson(enrollment.course.curriculumJson as string);
      const curriculum = await populateMediaVaultNodes(rawCurriculum);
      const videoNodes = collectVideoNodes(curriculum);
      
      const totalCount = videoNodes.length;
      if (totalCount === 0) {
        progressMap[courseId] = 0;
        continue;
      }

      const completedSet = completedByCourse[courseId] || new Set();
      const completedCount = videoNodes.filter(node => completedSet.has(node.id)).length;
      
      progressMap[courseId] = Math.round((completedCount / totalCount) * 100);
    }

    return NextResponse.json({ progress: progressMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
