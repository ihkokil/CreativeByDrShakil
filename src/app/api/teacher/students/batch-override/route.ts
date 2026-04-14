import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const customDelayDays = Number(body.customDelayDays) || 7;

    if (!courseId || !userId || !action) {
      return NextResponse.json({ error: 'courseId, userId, and action are required.' }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: payload.role === 'admin' ? { id: courseId } : { id: courseId, teacherId: payload.sub },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const order = await prisma.order.findFirst({
      where: { userId, courseId, status: 'approved' },
      orderBy: { updatedAt: 'asc' },
    });

    if (!order) {
      return NextResponse.json({ error: 'Student enrollment not found.' }, { status: 404 });
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

    let targetDates: Record<string, string> = {};

    if (action === 'all_available') {
      // Logic for all available handled below
    } else {
      let anchor: Date;
      let interval: number;
      let mode: any = course.releaseMode;

      const courseAnchor = course.releaseStartAt || course.courseStartDate || null;

      if (action === 'original') {
        anchor = (courseAnchor || order.updatedAt) as Date;
        interval = course.releaseIntervalDays || 7;
      } else if (action === 'custom_delay') {
        // As per user: count from enrollment day
        anchor = order.updatedAt;
        interval = customDelayDays;
        mode = 'fixed_interval';
      } else if (action === 'weekly') {
        // As per user: count from enrollment day
        anchor = order.updatedAt;
        interval = 7;
        mode = 'fixed_interval';
      } else {
        return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
      }

      targetDates = computeReleaseGroupDates(groups, {
        releaseMode: mode,
        releaseStartAt: anchor,
        releaseIntervalDays: interval,
        releaseGroupsPerWeek: course.releaseGroupsPerWeek,
        releaseDaysOfWeek: (course as any).releaseDaysOfWeek as any,
        releaseGroupDates: action === 'original' ? releaseGroupDates : {},
      });
    }

    const dataToInsert = action === 'all_available'
      ? groups.map(group => ({
          courseId,
          userId,
          lessonNodeId: group.nodeId,
          availabilityMode: 'available',
          availableAt: null
        }))
      : Object.entries(targetDates).map(([groupId, dateStr]) => ({
          courseId,
          userId,
          lessonNodeId: groupIdToNodeId.get(groupId)!,
          availabilityMode: 'available',
          availableAt: dateStr ? new Date(dateStr) : null
        }));

    await prisma.$transaction([
      prisma.studentModuleAvailability.deleteMany({
        where: { courseId, userId }
      }),
      prisma.studentModuleAvailability.createMany({
        data: dataToInsert
      })
    ]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
