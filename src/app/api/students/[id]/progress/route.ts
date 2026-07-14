import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { parseCurriculumJson, collectVideoNodes } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { eq, and, inArray } from 'drizzle-orm';
import { order as orderSchema, course as courseSchema, lessonProgress as lessonProgressSchema } from '@/db/schema';

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

    // 1. Find approved enrollments for this student (with course data via join)
    const enrollments = await db.select({
      courseId: orderSchema.courseId,
      courseCurriculumJson: courseSchema.curriculumJson,
    })
    .from(orderSchema)
    .leftJoin(courseSchema, eq(orderSchema.courseId, courseSchema.id))
    .where(and(eq(orderSchema.userId, studentId), eq(orderSchema.status, 'approved')));

    if (enrollments.length === 0) {
      return NextResponse.json({ progress: {} });
    }

    const courseIds = enrollments.map(e => e.courseId);

    // 2. Fetch all lesson progress for this student in these courses
    let progressRows: { courseId: string; lessonNodeId: string }[] = [];
    try {
      progressRows = await db.select({
        courseId: lessonProgressSchema.courseId,
        lessonNodeId: lessonProgressSchema.lessonNodeId,
      })
      .from(lessonProgressSchema)
      .where(and(
        eq(lessonProgressSchema.userId, studentId),
        inArray(lessonProgressSchema.courseId, courseIds)
      ));
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
      const rawCurriculum = parseCurriculumJson(enrollment.courseCurriculumJson);
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
