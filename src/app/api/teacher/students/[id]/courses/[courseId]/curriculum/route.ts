import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import {
  annotateCurriculumAvailability,
  BuilderNodeWithAvailability,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { parseDbDate } from '@/lib/date-format';

type OverrideRow = {
  lessonNodeId: string;
  availabilityMode: 'inherit' | 'available' | 'locked';
  availableAt: Date | string | null;
};

const annotateCompletion = (
  nodes: BuilderNodeWithAvailability[],
  completedSet: Set<string>
): BuilderNodeWithAvailability[] => {
  return nodes.map((node) => ({
    ...node,
    ...(node.type !== 'folder' ? { completed: completedSet.has(node.id) } : {}),
    children: node.children?.length ? annotateCompletion(node.children, completedSet) : node.children,
  }));
};

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string; courseId: string }> }
) {
  try {
    const resolvedParams = await params;
    const payload = await getAuthPayload(request);
    
    // Only admins or teachers should access this
    if (!payload || !['admin', 'teacher'].includes(payload.role)) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: studentId, courseId } = resolvedParams;

    const course = await db.query.course.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, courseId)),
      columns: {
        id: true,
        title: true,
        timezone: true,
        releaseMode: true,
        releaseStartAt: true,
        releaseIntervalDays: true,
        releaseGroupsPerWeek: true,
        releaseDaysOfWeek: true,
        releaseGroupDates: true,
        curriculumJson: true,
        courseStartDate: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const order = await db.query.order.findFirst({
      where: (o, { eq, and }) => and(
        eq(o.userId, studentId),
        eq(o.courseId, courseId),
        eq(o.status, 'approved')
      ),
    });

    if (!order) {
      return NextResponse.json({ error: 'Student is not enrolled in this course.' }, { status: 404 });
    }

    const studentEnrollmentDate = order.enrolledAt || order.updatedAt || null;

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode || 'circular',
      releaseStartAt: studentEnrollmentDate,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: course.releaseDaysOfWeek,
    });

    const overrideRows = await db.query.studentModuleAvailability.findMany({
      where: (sma, { eq, and }) => and(eq(sma.courseId, courseId), eq(sma.userId, studentId)),
      columns: {
        lessonNodeId: true,
        availabilityMode: true,
        availableAt: true,
      },
    });

    const curriculumWithAvailability = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      new Date(),
      overrideRows.map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      }))
    );

    const completedRows = await db.query.lessonProgress.findMany({
      where: (lp, { eq, and }) => and(eq(lp.userId, studentId), eq(lp.courseId, courseId)),
      columns: {
        lessonNodeId: true,
      },
    });
    
    const completedSet = new Set<string>(completedRows.map((row: any) => row.lessonNodeId));
    const curriculumWithProgress = annotateCompletion(curriculumWithAvailability, completedSet);

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        timezone: course.timezone,
      },
      curriculum: curriculumWithProgress,
      groups,
      computedReleaseGroupDates,
      enrollmentDate: studentEnrollmentDate,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
