import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

    const course = await prisma.course.findFirst({
      where: {
        slug: resolvedParams.slug,
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
        releaseGroupDates: true,
        curriculumJson: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const hasAccess = await prisma.order.findFirst({
      where: {
        userId: payload.sub,
        courseId: course.id,
        status: 'approved',
        updatedAt: {
          gte: oneYearAgo,
        },
      },
      select: { id: true },
    });

    if (!hasAccess) {
      return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseGroupDates,
    });

    const curriculumWithAvailability = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      new Date()
    );

    const completedRows = await prisma.lessonProgress.findMany({
      where: {
        userId: payload.sub,
        courseId: course.id,
      },
      select: {
        lessonNodeId: true,
      },
    });
    const completedSet = new Set(completedRows.map((row) => row.lessonNodeId));
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
