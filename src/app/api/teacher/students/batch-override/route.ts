import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const action = typeof body.action === 'string' ? body.action.trim() : '';
    const intervalDays = Number(body.intervalDays) || 7;
    const daysOfWeek = Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [];
    
    // Support single userId or array of userIds
    let userIds: string[] = [];
    if (typeof body.userId === 'string' && body.userId.trim()) {
      userIds.push(body.userId.trim());
    } else if (Array.isArray(body.userIds) && body.userIds.length > 0) {
      userIds = body.userIds.filter((id: any) => typeof id === 'string' && id.trim()).map((id: string) => id.trim());
    }

    if (!courseId || userIds.length === 0 || !action) {
      return NextResponse.json({ error: 'courseId, userId(s), and action are required.' }, { status: 400 });
    }

    const course = await db.course.findFirst({
      where: payload.role === 'admin' ? { id: courseId } : { id: courseId, teacherId: payload.sub },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check that ALL requested students have an active enrollment
    // If not all are enrolled, we might either fail entirely or just process the valid ones. Let's process the valid ones.
    const orders = await db.order.findMany({
      where: {
        userId: { in: userIds },
        courseId,
        status: 'approved',
      },
      select: { userId: true },
    });

    const enrolledUserIds = orders.map(o => o.userId);
    if (enrolledUserIds.length === 0) {
      return NextResponse.json({ error: 'No valid student enrollments found.' }, { status: 404 });
    }

    if (action === 'continue_with_batch') {
      // Clear custom overrides to fall back to course schedule
      await db.studentModuleAvailability.deleteMany({
        where: {
          courseId,
          userId: { in: enrolledUserIds },
        }
      });
      return NextResponse.json({ success: true, count: enrolledUserIds.length });
    }

    if (action === 'custom_date') {
      const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
      if (!startDate) {
        return NextResponse.json({ error: 'Start date is required for custom date.' }, { status: 400 });
      }

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate)) {
        return NextResponse.json({ error: 'Start date must be in YYYY-MM-DD format.' }, { status: 400 });
      }

      const start = new Date(startDate);

      if (Number.isNaN(start.getTime())) {
        return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 });
      }

      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);

      // Update the student enrollment orders
      await db.order.updateMany({
        where: {
          courseId,
          userId: { in: enrolledUserIds },
        },
        data: {
          enrolledAt: start,
          expiresAt: end,
          updatedAt: new Date(),
        }
      });

      // Clear student custom overrides so they follow the course schedule starting from the new enrolledAt date
      await db.studentModuleAvailability.deleteMany({
        where: {
          courseId,
          userId: { in: enrolledUserIds },
        }
      });

      return NextResponse.json({ success: true, count: enrolledUserIds.length });
    }

    const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);

    if (action === 'unlock_all') {
      const allNodeIds: string[] = [];
      const collect = (nodes: any[]) => {
        nodes.forEach(n => {
          allNodeIds.push(n.id);
          if (n.children?.length) collect(n.children);
        });
      };
      collect(curriculum);

      const dataToInsert: any[] = [];
      enrolledUserIds.forEach(uid => {
        allNodeIds.forEach(nodeId => {
          dataToInsert.push({
            id: randomUUID(),
            courseId,
            userId: uid,
            lessonNodeId: nodeId,
            availabilityMode: 'available',
            availableAt: null,
          });
        });
      });

      await db.studentModuleAvailability.deleteMany({
        where: {
          courseId,
          userId: { in: enrolledUserIds },
        }
      });
      
      if (dataToInsert.length > 0) {
        await db.studentModuleAvailability.createMany({
          data: dataToInsert
        });
      }

      return NextResponse.json({ success: true, count: enrolledUserIds.length });
    }

    const groups = collectSecondChildGroups(curriculum);
    const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

    let targetDates: Record<string, string> = {};
    const anchor = new Date(); // Start from today
    let mode: any = course.releaseMode;
    let computedInterval = course.releaseIntervalDays || 7;
    let computedDaysOfWeek = typeof course.releaseDaysOfWeek === 'string' ? JSON.parse(course.releaseDaysOfWeek) : course.releaseDaysOfWeek;

    if (action === 'start_from_today') {
      // Use course's interval/mode but start from today
      mode = course.releaseMode;
      computedInterval = course.releaseIntervalDays || 7;
      computedDaysOfWeek = typeof course.releaseDaysOfWeek === 'string' ? JSON.parse(course.releaseDaysOfWeek) : course.releaseDaysOfWeek;
    } else if (action === 'custom_interval') {
      mode = 'fixed_interval';
      computedInterval = intervalDays;
    } else if (action === 'week_days') {
      mode = 'day_of_week';
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

    const dataToInsert: any[] = [];
    enrolledUserIds.forEach(uid => {
      Object.entries(targetDates).forEach(([groupId, dateStr]) => {
        dataToInsert.push({
          id: randomUUID(),
          courseId,
          userId: uid,
          lessonNodeId: groupIdToNodeId.get(groupId)!,
          availabilityMode: 'available',
          availableAt: dateStr ? new Date(dateStr) : null,
        });
      });
    });

    await db.studentModuleAvailability.deleteMany({
      where: {
        courseId,
        userId: { in: enrolledUserIds },
      }
    });

    if (dataToInsert.length > 0) {
      await db.studentModuleAvailability.createMany({
        data: dataToInsert
      });
    }

    return NextResponse.json({ success: true, count: enrolledUserIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
