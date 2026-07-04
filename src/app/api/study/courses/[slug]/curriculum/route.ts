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

    const course = await db.course.findFirst({
      where: { slug: resolvedParams.slug, status: 'published' },
      select: {
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

    const isAdmin = payload.role === 'admin';

    let studentEnrollmentDate: string | Date | null = null;
    if (!isAdmin) {
      const order = await db.order.findFirst({
        where: {
          userId: payload.sub,
          courseId: course.id,
          status: 'approved'
        },
      });

      if (!order) {
        return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
      }

      // Check access date range
      const enrolledAtDate = order.enrolledAt ? new Date(order.enrolledAt) : null;
      const expiresAtDate = order.expiresAt ? new Date(order.expiresAt) : null;
      const now = new Date();

      if (enrolledAtDate && now < enrolledAtDate) {
        return NextResponse.json({ error: 'Course access has not started yet.' }, { status: 403 });
      }
      if (expiresAtDate && now > expiresAtDate) {
        return NextResponse.json({ error: 'Course access has expired.' }, { status: 403 });
      }

      studentEnrollmentDate = order.enrolledAt || order.updatedAt || null;
    }

    const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    const courseAnchor = course.releaseStartAt || course.courseStartDate || null;
    const effectiveStartAt = courseAnchor || studentEnrollmentDate;

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode as any || 'circular',
      releaseStartAt: studentEnrollmentDate as any,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: typeof course.releaseDaysOfWeek === 'string' ? JSON.parse(course.releaseDaysOfWeek) : course.releaseDaysOfWeek,
    });

    const overrideRows = await db.studentModuleAvailability.findMany({
      where: { courseId: course.id, userId: payload.sub },
      select: {
        lessonNodeId: true,
        availabilityMode: true,
        availableAt: true,
      },
    });

    const curriculumWithAvailability = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      isAdmin ? new Date('9999-12-31') : new Date(),
      isAdmin ? [] : overrideRows.map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      }))
    );

    const completedRows = await db.lessonProgress.findMany({
      where: { userId: payload.sub, courseId: course.id },
      select: {
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
