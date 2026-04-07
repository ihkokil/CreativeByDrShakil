import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { buildCurriculumFromStarter } from '@/lib/starter-catalog';

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  if (role === 'admin') {
    return prisma.course.findUnique({ where: { id: courseId } });
  }

  return prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const resolvedParams = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const course = await getCourseForPayload(resolvedParams.courseId, payload.sub, payload.role);
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const body = await request.json();
    const mainTopicIds = Array.isArray(body.mainTopicIds)
      ? body.mainTopicIds.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];

    if (!mainTopicIds.length) {
      return NextResponse.json({ error: 'At least one main topic must be selected.' }, { status: 400 });
    }

    const existingCurriculum = parseCurriculumJson(course.curriculumJson);
    const importedNodes = buildCurriculumFromStarter(mainTopicIds);
    const mergedCurriculum = ensureGroupInheritance([...existingCurriculum, ...importedNodes]);

    const groups = collectSecondChildGroups(mergedCurriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    groups.forEach((group) => {
      if (!releaseGroupDates[group.id]) {
        releaseGroupDates[group.id] = '';
      }
    });

    const compactReleaseGroupDates = Object.entries(releaseGroupDates).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const updatedCourse = await prisma.course.update({
      where: { id: course.id },
      data: {
        curriculumJson: mergedCurriculum as unknown as Prisma.InputJsonValue,
        releaseGroupDates: compactReleaseGroupDates as Prisma.InputJsonValue,
      },
    });

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: updatedCourse.releaseMode,
      releaseStartAt: updatedCourse.releaseStartAt,
      releaseIntervalDays: updatedCourse.releaseIntervalDays,
      releaseGroupsPerWeek: updatedCourse.releaseGroupsPerWeek,
      releaseGroupDates: compactReleaseGroupDates,
    });

    return NextResponse.json({
      curriculum: mergedCurriculum,
      groups,
      releaseGroupDates: compactReleaseGroupDates,
      computedReleaseGroupDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
