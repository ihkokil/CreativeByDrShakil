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
  stripLockedChildren,
  sortCurriculumByAvailability,
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const resolvedParams = await params;
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    interface CourseResult {
      id: string;
      title: string;
      timezone: string;
      releaseMode: any;
      releaseStartAt: Date | null;
      releaseIntervalDays: number | null;
      releaseGroupsPerWeek: number | null;
      releaseDaysOfWeek: any;
      releaseGroupDates: any;
      curriculumJson: any;
      courseStartDate: Date | null;
    }

    const course = await db.query.course.findFirst({
      where: (c, { eq, and }) => and(eq(c.slug, resolvedParams.slug), eq(c.status, 'published')),
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
    }) as CourseResult | undefined;

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const isAdmin = payload.role === 'admin';

    let studentEnrollmentDate = null;
    let isEnrolledAndNotStarted = false;

    if (payload.role !== 'admin') {
      const order = await db.query.order.findFirst({
        where: (o, { eq, and }) => and(
          eq(o.userId, payload.sub),
          eq(o.courseId, course.id),
          eq(o.status, 'approved')
        ),
      });

      if (!order) {
        return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
      }

      // Check access date range
      const enrolledAtDate = order.enrolledAt ? parseDbDate(order.enrolledAt) : null;
      const expiresAtDate = order.expiresAt ? parseDbDate(order.expiresAt) : null;
      const now = new Date();

      if (enrolledAtDate && now < enrolledAtDate) {
        isEnrolledAndNotStarted = true;
      }
      if (expiresAtDate && now > expiresAtDate) {
        return NextResponse.json({ error: 'Course access has expired.' }, { status: 403 });
      }

      studentEnrollmentDate = order.enrolledAt || order.updatedAt || null;
    }

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    const courseAnchor = course.releaseStartAt || course.courseStartDate || null;
    const effectiveStartAt = courseAnchor || studentEnrollmentDate;

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode || 'circular',
      releaseStartAt: studentEnrollmentDate,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: typeof course.releaseDaysOfWeek === 'string'
        ? JSON.parse(course.releaseDaysOfWeek)
        : course.releaseDaysOfWeek as any,
    });

    const overrideRows = await db.query.studentModuleAvailability.findMany({
      where: (sma, { eq, and }) => and(eq(sma.courseId, course.id), eq(sma.userId, payload.sub)),
      columns: {
        lessonNodeId: true,
        availabilityMode: true,
        availableAt: true,
      },
    });

    // If admin, use a far-future-past 'now' to ensure everything is unlocked,
    // or simply pass a flag to the availability annotator.
    // Actually, passing a far future Date for 'now' to annotateCurriculumAvailability will unlock everything.
    const curriculumWithAvailability = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      isEnrolledAndNotStarted ? new Date(0) : (isAdmin ? new Date('9999-12-31') : new Date()),
      isAdmin ? [] : overrideRows.map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      }))
    );

    const completedRows = await db.query.lessonProgress.findMany({
      where: (lp, { eq, and }) => and(eq(lp.userId, payload.sub), eq(lp.courseId, course.id)),
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
      curriculum: sortCurriculumByAvailability(stripLockedChildren(curriculumWithProgress)),
      groups,
      computedReleaseGroupDates,
      enrollmentDate: studentEnrollmentDate,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
