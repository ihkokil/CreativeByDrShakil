import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { course as courseSchema, order as orderSchema, studentModuleAvailability as smaSchema } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    const intervalDays = Number(body.intervalDays) || 7;
    const daysOfWeek = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [];

    if (!courseId || !userId || !action) {
      return NextResponse.json({ error: 'courseId, userId, and action are required.' }, { status: 400 });
    }

    const course = await db.query.course.findFirst({
      where: (c, { eq, and }) => payload.role === 'admin' ? eq(c.id, courseId) : and(eq(c.id, courseId), eq(c.teacherId, payload.sub)),
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const order = await db.query.order.findFirst({
      where: (o, { eq, and }) => and(eq(o.userId, userId), eq(o.courseId, courseId), eq(o.status, 'approved')),
      orderBy: (o, { asc }) => [asc(o.updatedAt)],
    });

    if (!order) {
      return NextResponse.json({ error: 'Student enrollment not found.' }, { status: 404 });
    }

    if (action === 'continue_with_batch') {
      // Clear custom overrides to fall back to course schedule
      await db.delete(smaSchema).where(and(eq(smaSchema.courseId, courseId), eq(smaSchema.userId, userId)));
      return NextResponse.json({ success: true });
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(course.curriculumJson));

    if (action === 'unlock_all') {
      const allNodeIds: string[] = [];
      const collect = (nodes: any[]) => {
        nodes.forEach(n => {
          allNodeIds.push(n.id);
          if (n.children?.length) collect(n.children);
        });
      };
      collect(curriculum);

      const dataToInsert = allNodeIds.map(nodeId => ({
        courseId,
        userId,
        lessonNodeId: nodeId,
        availabilityMode: 'available',
        availableAt: null,
        updatedAt: new Date().toISOString()
      }));

      await db.transaction(async (tx) => {
        await tx.delete(smaSchema).where(and(eq(smaSchema.courseId, courseId), eq(smaSchema.userId, userId)));
        if (dataToInsert.length > 0) {
          await tx.insert(smaSchema).values(dataToInsert.map(d => ({ id: randomUUID(), ...d })));
        }
      });

      return NextResponse.json({ success: true });
    }

    const groups = collectSecondChildGroups(curriculum);
    const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

    let targetDates: Record<string, string> = {};
    const anchor = new Date(); // Start from today
    let mode: any = course.releaseMode;
    let computedInterval = course.releaseIntervalDays || 7;
    let computedDaysOfWeek = (course as any).releaseDaysOfWeek as any;

    if (action === 'start_from_today') {
      // Use course's interval/mode but start from today
      mode = course.releaseMode;
      computedInterval = course.releaseIntervalDays || 7;
      computedDaysOfWeek = (course as any).releaseDaysOfWeek as any;
    } else if (action === 'custom_interval') {
      mode = 'fixed_interval';
      computedInterval = intervalDays;
    } else if (action === 'week_days') {
      mode = 'days_of_week';
      computedDaysOfWeek = daysOfWeek;
    } else {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    targetDates = computeReleaseGroupDates(groups, {
      releaseMode: mode,
      releaseStartAt: anchor,
      releaseIntervalDays: computedInterval,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: computedDaysOfWeek,
      releaseGroupDates: {}, // Ignore custom group dates when overriding schedule
    });

    const dataToInsert = Object.entries(targetDates).map(([groupId, dateStr]) => ({
      courseId,
      userId,
      lessonNodeId: groupIdToNodeId.get(groupId)!,
      availabilityMode: 'available',
      availableAt: dateStr ? new Date(dateStr).toISOString() : null,
      updatedAt: new Date().toISOString()
    }));

    await db.transaction(async (tx) => {
        await tx.delete(smaSchema).where(and(eq(smaSchema.courseId, courseId), eq(smaSchema.userId, userId)));
        if (dataToInsert.length > 0) {
          await tx.insert(smaSchema).values(dataToInsert.map(d => ({ id: randomUUID(), ...d })));
        }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
