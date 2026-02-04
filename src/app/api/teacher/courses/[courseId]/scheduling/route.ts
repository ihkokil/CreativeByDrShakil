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

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  if (role === 'admin') {
    return prisma.course.findUnique({ where: { id: courseId } });
  }

  return prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
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
    const updateData: Record<string, unknown> = {};

    if (body.releaseMode !== undefined) {
      const validModes = ['fixed_interval', 'groups_per_week', 'explicit_dates', null];
      if (!validModes.includes(body.releaseMode)) {
        return NextResponse.json({ error: 'Invalid release mode.' }, { status: 400 });
      }
      updateData.releaseMode = body.releaseMode;
    }

    if (body.releaseStartAt !== undefined) {
      updateData.releaseStartAt = body.releaseStartAt ? new Date(body.releaseStartAt) : null;
    }

    if (body.releaseIntervalDays !== undefined) {
      const parsed = Number(body.releaseIntervalDays);
      if (!Number.isNaN(parsed) && parsed < 1) {
        return NextResponse.json({ error: 'releaseIntervalDays must be >= 1.' }, { status: 400 });
      }
      updateData.releaseIntervalDays = Number.isNaN(parsed) ? null : Math.floor(parsed);
    }

    if (body.releaseGroupsPerWeek !== undefined) {
      const parsed = Number(body.releaseGroupsPerWeek);
      if (![2, 3].includes(parsed)) {
        return NextResponse.json({ error: 'releaseGroupsPerWeek must be 2 or 3.' }, { status: 400 });
      }
      updateData.releaseGroupsPerWeek = parsed;
    }

    if (body.releaseGroupDates !== undefined) {
      updateData.releaseGroupDates = parseReleaseGroupDateMap(body.releaseGroupDates) as Prisma.InputJsonValue;
    }

    if (typeof body.timezone === 'string' && body.timezone.trim()) {
      updateData.timezone = body.timezone.trim();
    }

    if (body.status !== undefined) {
      const validStatus = ['draft', 'scheduled', 'published', 'archived'];
      if (!validStatus.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid course status.' }, { status: 400 });
      }

      updateData.status = body.status;
      updateData.publishedAt = body.status === 'published' ? new Date() : null;
    }

    const updatedCourse = await prisma.course.update({
      where: { id: course.id },
      data: updateData,
    });

    const curriculum = ensureGroupInheritance(parseCurriculumJson(updatedCourse.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(updatedCourse.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: updatedCourse.releaseMode,
      releaseStartAt: updatedCourse.releaseStartAt,
      releaseIntervalDays: updatedCourse.releaseIntervalDays,
      releaseGroupsPerWeek: updatedCourse.releaseGroupsPerWeek,
      releaseGroupDates,
    });

    return NextResponse.json({
      course: {
        id: updatedCourse.id,
        status: updatedCourse.status,
        releaseMode: updatedCourse.releaseMode,
        releaseStartAt: updatedCourse.releaseStartAt,
        releaseIntervalDays: updatedCourse.releaseIntervalDays,
        releaseGroupsPerWeek: updatedCourse.releaseGroupsPerWeek,
        timezone: updatedCourse.timezone,
      },
      groups,
      releaseGroupDates,
      computedReleaseGroupDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
