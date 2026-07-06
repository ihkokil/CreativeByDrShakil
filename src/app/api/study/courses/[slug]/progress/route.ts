import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';
import {
  annotateCurriculumAvailability,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  BuilderNodeWithAvailability,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

const getCourseWithAccess = async (slug: string, userId: string, role?: string) => {
  const course = await db.query.courses.findFirst({
    where: and(eq(schema.courses.slug, slug), eq(schema.courses.status, 'published')),
    columns: {
      id: true,
      title: true,
      timezone: true,
      releaseMode: true,
      releaseStartAt: true,
      courseStartDate: true,
      releaseIntervalDays: true,
      releaseGroupsPerWeek: true,
      releaseDaysOfWeek: true,
      releaseGroupDates: true,
      curriculumJson: true,
    },
  });

  if (!course) {
    return { error: NextResponse.json({ error: 'Course not found.' }, { status: 404 }) };
  }

  if (role === 'admin') {
    return { course, studentEnrollmentDate: null };
  }

  const order = await db.query.orders.findFirst({
    where: and(
      eq(schema.orders.userId, userId),
      eq(schema.orders.courseId, course.id),
      eq(schema.orders.status, 'approved')
    ),
  });

  if (!order) {
    return { error: NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 }) };
  }

  // Check access date range
  const enrolledAtDate = order.enrolledAt ? new Date(order.enrolledAt) : null;
  const expiresAtDate = order.expiresAt ? new Date(order.expiresAt) : null;
  const now = new Date();

  if (enrolledAtDate && now < enrolledAtDate) {
    return { error: NextResponse.json({ error: 'Course access has not started yet.' }, { status: 403 }) };
  }
  if (expiresAtDate && now > expiresAtDate) {
    return { error: NextResponse.json({ error: 'Course access has expired.' }, { status: 403 }) };
  }

  return { course, studentEnrollmentDate: order.enrolledAt || order.updatedAt };
};

const collectPlayableNodes = (nodes: BuilderNodeWithAvailability[]) => {
  const playableMap = new Map<string, BuilderNodeWithAvailability>();
  const walk = (list: BuilderNodeWithAvailability[]) => {
    list.forEach((node: any) => {
      if (node.type !== 'folder') {
        playableMap.set(node.id, node);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return playableMap;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const result = await getCourseWithAccess(resolvedParams.slug, payload.sub, payload.role);
    if (result.error) {
      return result.error;
    }

    const isAdmin = payload.role === 'admin';

    const rawCurriculum = parseCurriculumJson(result.course!.curriculumJson as string);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const dbReleaseStart = result.course?.releaseStartAt;
    const dbCourseStart = result.course?.courseStartDate;
    const dbEnrollment = result.studentEnrollmentDate;

    const courseAnchor = dbReleaseStart || dbCourseStart || null;
    const finalStartAt = courseAnchor || dbEnrollment;

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: result.course?.releaseMode as any || 'circular',
      releaseStartAt: finalStartAt as any,
      releaseIntervalDays: result.course?.releaseIntervalDays,
      releaseGroupsPerWeek: result.course?.releaseGroupsPerWeek,
      releaseDaysOfWeek: typeof result.course?.releaseDaysOfWeek === 'string' ? JSON.parse(result.course.releaseDaysOfWeek) : result.course?.releaseDaysOfWeek,
    });

    const overrideRows = await db.query.studentModuleAvailability.findMany({
      where: and(eq(schema.studentModuleAvailability.courseId, result.course!.id), eq(schema.studentModuleAvailability.userId, payload.sub)),
      columns: {
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
    const playableNodes = collectPlayableNodes(curriculumWithAvailability);
    const completedRows = await db.query.lessonProgress.findMany({
      where: and(eq(schema.lessonProgress.userId, payload.sub), eq(schema.lessonProgress.courseId, result.course!.id)),
      columns: {
        lessonNodeId: true,
      },
    });

    const completedLessonIds = completedRows
      .map((row: any) => row.lessonNodeId)
      .filter((lessonNodeId: string) => playableNodes.has(lessonNodeId));

    return NextResponse.json({
      course: {
        id: result.course!.id,
        title: result.course!.title,
      },
      curriculum: curriculumWithAvailability,
      progress: {
        completedLessonIds,
        completedCount: completedLessonIds.length,
        totalCount: playableNodes.size,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const result = await getCourseWithAccess(resolvedParams.slug, payload.sub, payload.role);
    if (result.error) {
      return result.error;
    }

    const isAdmin = payload.role === 'admin';

    const body = await request.json();
    const lessonNodeId = typeof body.lessonNodeId === 'string' ? body.lessonNodeId.trim() : '';
    if (!lessonNodeId) {
      return NextResponse.json({ error: 'lessonNodeId is required.' }, { status: 400 });
    }

    const rawCurriculum = parseCurriculumJson(result.course!.curriculumJson as string);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const dbReleaseStart = result.course?.releaseStartAt;
    const dbCourseStart = result.course?.courseStartDate;
    const dbEnrollment = result.studentEnrollmentDate;

    const courseAnchor = dbReleaseStart || dbCourseStart || null;
    const finalStartAt = courseAnchor || dbEnrollment;

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: result.course?.releaseMode as any || 'circular',
      releaseStartAt: finalStartAt as any,
      releaseIntervalDays: result.course?.releaseIntervalDays,
      releaseGroupsPerWeek: result.course?.releaseGroupsPerWeek,
      releaseDaysOfWeek: typeof result.course?.releaseDaysOfWeek === 'string' ? JSON.parse(result.course.releaseDaysOfWeek) : result.course?.releaseDaysOfWeek,
    });

    const overrideRows = await db.query.studentModuleAvailability.findMany({
      where: and(eq(schema.studentModuleAvailability.courseId, result.course!.id), eq(schema.studentModuleAvailability.userId, payload.sub)),
      columns: {
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
    const playableNodes = collectPlayableNodes(curriculumWithAvailability);
    const lesson = playableNodes.get(lessonNodeId);

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found in this course.' }, { status: 404 });
    }

    if (lesson.locked && !isAdmin) {
      return NextResponse.json({ error: 'This lesson is currently locked.' }, { status: 400 });
    }

    await db.delete(schema.lessonProgress).where(and(
      eq(schema.lessonProgress.userId, payload.sub),
      eq(schema.lessonProgress.courseId, result.course!.id),
      eq(schema.lessonProgress.lessonNodeId, lessonNodeId)
    ));

    await db.insert(schema.lessonProgress).values({
      id: crypto.randomUUID(),
      userId: payload.sub,
      courseId: result.course!.id,
      lessonNodeId,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const completedRows = await db.query.lessonProgress.findMany({
      where: and(eq(schema.lessonProgress.userId, payload.sub), eq(schema.lessonProgress.courseId, result.course!.id)),
      columns: {
        lessonNodeId: true,
      },
    });

    const completedLessonIds = completedRows
      .map((row: any) => row.lessonNodeId)
      .filter((id: string) => playableNodes.has(id));

    return NextResponse.json({
      progress: {
        completedLessonIds,
        completedCount: completedLessonIds.length,
        totalCount: playableNodes.size,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
