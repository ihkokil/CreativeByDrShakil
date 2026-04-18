import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

type OverrideRow = {
  lessonNodeId: string;
  availabilityMode: 'inherit' | 'available' | 'locked';
  availableAt: Date | string | null;
};

const getCourseWithAccess = async (slug: string, userId: string, role?: string) => {
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
  }

  const course = await prisma.course.findFirst({
    where: {
      slug,
      status: 'published',
    },
    select: {
      id: true,
      title: true,
      timezone: true,
      releaseMode: true,
      releaseStartAt: true,
      releaseIntervalDays: true,
      releaseGroupsPerWeek: true,
      ...({ releaseDaysOfWeek: true } as any),
      releaseGroupDates: true,
      curriculumJson: true,
    },
  }) as CourseResult | null;

  if (!course) {
    return { error: NextResponse.json({ error: 'Course not found.' }, { status: 404 }) };
  }

  if (role === 'admin') {
    return { course, studentEnrollmentDate: null };
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const hasAccess = await prisma.order.findFirst({
    where: {
      userId,
      courseId: course.id,
      status: 'approved',
      updatedAt: {
        gte: oneYearAgo,
      },
    },
    orderBy: { updatedAt: 'asc' },
    select: { id: true, updatedAt: true },
  });

  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 }) };
  }

  return { course, studentEnrollmentDate: hasAccess.updatedAt };
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

    const curriculum = ensureGroupInheritance(parseCurriculumJson(result.course!.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(result.course!.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: result.course!.releaseMode,
      releaseStartAt: result.course!.releaseStartAt || result.studentEnrollmentDate,
      releaseIntervalDays: result.course!.releaseIntervalDays,
      releaseGroupsPerWeek: result.course!.releaseGroupsPerWeek,
      releaseDaysOfWeek: (result.course as any).releaseDaysOfWeek as number[],
      releaseGroupDates,
    });

    const overrideRows = await prisma.studentModuleAvailability.findMany({
      where: {
        courseId: result.course!.id,
        userId: payload.sub,
      },
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
    const playableNodes = collectPlayableNodes(curriculumWithAvailability);
    const completedRows = await prisma.lessonProgress.findMany({
      where: {
        userId: payload.sub,
        courseId: result.course!.id,
      },
      select: {
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

    const curriculum = ensureGroupInheritance(parseCurriculumJson(result.course!.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(result.course!.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: result.course!.releaseMode,
      releaseStartAt: result.course!.releaseStartAt || result.studentEnrollmentDate,
      releaseIntervalDays: result.course!.releaseIntervalDays,
      releaseGroupsPerWeek: result.course!.releaseGroupsPerWeek,
      releaseDaysOfWeek: (result.course as any).releaseDaysOfWeek as number[],
      releaseGroupDates,
    });

    const overrideRows = await prisma.studentModuleAvailability.findMany({
      where: {
        courseId: result.course!.id,
        userId: payload.sub,
      },
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
    const playableNodes = collectPlayableNodes(curriculumWithAvailability);
    const lesson = playableNodes.get(lessonNodeId);

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found in this course.' }, { status: 404 });
    }

    if (lesson.locked && !isAdmin) {
      return NextResponse.json({ error: 'This lesson is currently locked.' }, { status: 400 });
    }

    await prisma.lessonProgress.upsert({
      where: {
        userId_courseId_lessonNodeId: {
          userId: payload.sub,
          courseId: result.course!.id,
          lessonNodeId,
        },
      },
      create: {
        userId: payload.sub,
        courseId: result.course!.id,
        lessonNodeId,
        completedAt: new Date(),
      },
      update: {
        completedAt: new Date(),
      },
    });

    const completedRows = await prisma.lessonProgress.findMany({
      where: {
        userId: payload.sub,
        courseId: result.course!.id,
      },
      select: {
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
