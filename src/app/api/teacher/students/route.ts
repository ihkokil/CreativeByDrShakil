import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { course as courseSchema, courseInstructor as courseInstructorSchema, lessonProgress as lessonProgressSchema, studentModuleAvailability as smaSchema, order as orderSchema, user as userSchema } from '@/db/schema';
import { eq, inArray, and, gte, desc, asc } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  annotateCurriculumAvailability,
  collectSecondChildGroups,
  collectVideoNodes,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  LessonAvailabilityOverride,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

const OVERRIDE_TABLE = 'StudentModuleAvailability';

type TeacherCourseSummary = {
  id: string;
  slug: string | null;
  title: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  duration: string;
  imageUrl: string | null;
  instructors: Array<{ id: string; name: string; designation?: string | null }>;
  _count: { orders: number };
};

type CourseStudent = {
  id: string;
  fullName: string;
  email: string;
  profileImage: string | null;
  enrolledAt: string;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
};

type OverrideRow = {
  userId: string;
  lessonNodeId: string;
  availabilityMode: 'inherit' | 'available' | 'locked';
  availableAt: Date | string | null;
};

type ProgressRow = {
  userId: string;
  lessonNodeId: string;
};

import { sql } from 'drizzle-orm';
// ...

const getTeacherCourses = async (teacherId: string, role: string) => {
  const [rawCourses, orderCountsData] = await Promise.all([
    db.select().from(courseSchema).orderBy(desc(courseSchema.updatedAt)),
    db.select({
      courseId: orderSchema.courseId,
      count: sql<number>`count(${orderSchema.id})`.mapWith(Number)
    })
    .from(orderSchema)
    .where(eq(orderSchema.status, 'approved'))
    .groupBy(orderSchema.courseId)
  ]);

  const courseIds = rawCourses.map(c => c.id);
  const instructors = courseIds.length > 0
    ? await db.select().from(courseInstructorSchema).where(inArray(courseInstructorSchema.courseId, courseIds)).orderBy(asc(courseInstructorSchema.sortOrder))
    : [];
  const instructorsMap = new Map<string, typeof instructors[number][]>();
  for (const inst of instructors) {
    const list = instructorsMap.get(inst.courseId) || [];
    list.push(inst);
    instructorsMap.set(inst.courseId, list);
  }

  const orderCountMap = new Map(orderCountsData.map(row => [row.courseId as string, row.count]));

  return rawCourses.map(c => ({
    ...c,
    instructors: instructorsMap.get(c.id) || [],
    _count: { orders: orderCountMap.get(c.id) || 0 },
  })) as unknown as TeacherCourseSummary[];
};

const buildAvailabilityOverrides = (rows: OverrideRow[]) => {
  const byUser = new Map<string, LessonAvailabilityOverride[]>();

  rows.forEach((row) => {
    const current = byUser.get(row.userId) || [];
    current.push({
      lessonNodeId: row.lessonNodeId,
      availabilityMode: row.availabilityMode,
      availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
    });
    byUser.set(row.userId, current);
  });

  return byUser;
};

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const courseIdParam = request.nextUrl.searchParams.get('courseId');
    const teacherCourses = await getTeacherCourses(payload.sub, payload.role);

    if (teacherCourses.length === 0) {
      return NextResponse.json({ courses: [], selectedCourse: null, students: [], curriculum: [], overrides: [] });
    }

    const selectedCourseId = courseIdParam && teacherCourses.some((course) => course.id === courseIdParam)
      ? courseIdParam
      : teacherCourses[0].id;

    interface CourseResult {
      id: string;
      title: string;
      slug: string | null;
      status: any;
      duration: string;
      imageUrl: string | null;
      releaseMode: any;
      releaseStartAt: Date | null;
      courseStartDate: Date | null;
      releaseIntervalDays: number | null;
      releaseGroupsPerWeek: number | null;
      releaseDaysOfWeek: any;
      releaseGroupDates: any;
      curriculumJson: any;
    }

    const [selectedCourse] = await db.select({
      id: courseSchema.id,
      title: courseSchema.title,
      slug: courseSchema.slug,
      status: courseSchema.status,
      duration: courseSchema.duration,
      imageUrl: courseSchema.imageUrl,
      releaseMode: courseSchema.releaseMode,
      releaseStartAt: courseSchema.releaseStartAt,
      releaseIntervalDays: courseSchema.releaseIntervalDays,
      releaseGroupsPerWeek: courseSchema.releaseGroupsPerWeek,
      releaseDaysOfWeek: courseSchema.releaseDaysOfWeek,
      releaseGroupDates: courseSchema.releaseGroupDates,
      curriculumJson: courseSchema.curriculumJson,
      courseStartDate: courseSchema.courseStartDate,
    }).from(courseSchema).where(eq(courseSchema.id, selectedCourseId)).limit(1) as (CourseResult | undefined)[];

    if (!selectedCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const enrollmentsData = await db.select().from(orderSchema).where(
      and(eq(orderSchema.courseId, selectedCourse.id), eq(orderSchema.status, 'approved'), gte(orderSchema.updatedAt, oneYearAgo.toISOString()))
    ).orderBy(desc(orderSchema.updatedAt));

    const orderUserIds = [...new Set(enrollmentsData.map(o => o.userId).filter(Boolean))];
    const users = orderUserIds.length > 0
      ? await db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email, profileImage: userSchema.profileImage }).from(userSchema).where(inArray(userSchema.id, orderUserIds))
      : [];
    const usersMap = new Map(users.map(u => [u.id, u]));
    const enrollments = enrollmentsData.map(o => ({ ...o, user: usersMap.get(o.userId)! }));

    const userIds = enrollmentsData.map(o => o.userId);
    let progressRows: ProgressRow[] = [];
    let overrideRows: OverrideRow[] = [];

    // Safely query LessonProgress if it exists
    if (userIds.length > 0) {
      try {
        const lpResult = await db.select({ userId: lessonProgressSchema.userId, lessonNodeId: lessonProgressSchema.lessonNodeId }).from(lessonProgressSchema).where(and(eq(lessonProgressSchema.courseId, selectedCourse.id), inArray(lessonProgressSchema.userId, userIds)));
        progressRows = lpResult;
      } catch (err) {
        console.warn('LessonProgress query failed', err);
        progressRows = [];
      }

      // Safely query StudentModuleAvailability if it exists
      try {
        const smaResult = await db.select({ userId: smaSchema.userId, lessonNodeId: smaSchema.lessonNodeId, availabilityMode: smaSchema.availabilityMode, availableAt: smaSchema.availableAt }).from(smaSchema).where(and(eq(smaSchema.courseId, selectedCourse.id), inArray(smaSchema.userId, userIds)));
        overrideRows = smaResult as OverrideRow[];
      } catch (err) {
        console.warn('StudentModuleAvailability query failed', err);
        overrideRows = [];
      }
    }

    const rawCurriculum = parseCurriculumJson(selectedCourse.curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(selectedCourse.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
        releaseMode: selectedCourse.releaseMode,
        releaseStartAt: selectedCourse.releaseStartAt,
        releaseIntervalDays: selectedCourse.releaseIntervalDays,
        releaseGroupsPerWeek: selectedCourse.releaseGroupsPerWeek,
        releaseGroupDates,
    });

    const overridesByUser = buildAvailabilityOverrides(overrideRows);
    const progressByUser = progressRows.reduce<Record<string, string[]>>((acc: Record<string, string[]>, row: ProgressRow) => {
      if (!acc[row.userId]) acc[row.userId] = [];
      acc[row.userId].push(row.lessonNodeId);
      return acc;
    }, {});

    const allStudentsComputedDates: Record<string, Record<string, string>> = {};

    const students: CourseStudent[] = enrollments.map((enrollment) => {
      const studentOverrides = overridesByUser.get(enrollment.user.id) || [];
      
      const courseAnchor = selectedCourse.releaseStartAt || selectedCourse.courseStartDate || null;
      const studentReleaseStartAt = courseAnchor || enrollment.enrolledAt || enrollment.updatedAt;

      const studentComputedDates = computeReleaseGroupDates(groups, {
        releaseMode: selectedCourse.releaseMode as any,
        releaseStartAt: studentReleaseStartAt,
        releaseIntervalDays: selectedCourse.releaseIntervalDays,
        releaseGroupsPerWeek: selectedCourse.releaseGroupsPerWeek,
        releaseDaysOfWeek: (selectedCourse as any).releaseDaysOfWeek as number[],
        releaseGroupDates,
      });

      allStudentsComputedDates[enrollment.user.id] = studentComputedDates;

      const annotatedCurriculum = annotateCurriculumAvailability(
        curriculum,
        studentComputedDates,
        new Date(),
        studentOverrides
      );
      const lessonNodes = collectVideoNodes(annotatedCurriculum);
      const completedSet = new Set(progressByUser[enrollment.user.id] || []);
      const completedCount = lessonNodes.filter((node) => completedSet.has(node.id)).length;
      const totalCount = lessonNodes.length;

      return {
        id: enrollment.user.id,
        fullName: enrollment.user.fullName,
        email: enrollment.user.email,
        profileImage: enrollment.user.profileImage || null,
        enrolledAt: enrollment.enrolledAt || enrollment.updatedAt,
        completedCount,
        totalCount,
        progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      };
    });

    const selectedStudentId = students[0]?.id || null;

    return NextResponse.json({
      courses: teacherCourses,
      selectedCourse: {
        ...selectedCourse,
        curriculum,
        computedReleaseGroupDates,
        releaseGroupDates,
      },
      students,
      selectedStudentId,
      overrides: overrideRows.map((row) => ({
        userId: row.userId,
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      })),
      studentComputedDatesMap: allStudentsComputedDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const courseId = typeof body.courseId === 'string' ? body.courseId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const lessonNodeId = typeof body.lessonNodeId === 'string' ? body.lessonNodeId.trim() : '';
    const availabilityMode = typeof body.availabilityMode === 'string' ? body.availabilityMode.trim() : 'inherit';
    const availableAt = typeof body.availableAt === 'string' && body.availableAt.trim() ? new Date(body.availableAt) : null;

    if (!courseId || !userId || !lessonNodeId) {
      return NextResponse.json({ error: 'courseId, userId, and lessonNodeId are required.' }, { status: 400 });
    }

    const [course] = await db.select({ id: courseSchema.id }).from(courseSchema).where(eq(courseSchema.id, courseId)).limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (!['inherit', 'available', 'locked'].includes(availabilityMode)) {
      return NextResponse.json({ error: 'Invalid availability mode.' }, { status: 400 });
    }

    if (availabilityMode === 'inherit') {
      await db.delete(smaSchema).where(
        and(eq(smaSchema.courseId, courseId), eq(smaSchema.userId, userId), eq(smaSchema.lessonNodeId, lessonNodeId))
      );
    } else {
      const nextAvailableAt = availableAt && !Number.isNaN(availableAt.getTime()) ? availableAt : null;

      await db.delete(smaSchema).where(
        and(eq(smaSchema.courseId, courseId), eq(smaSchema.userId, userId), eq(smaSchema.lessonNodeId, lessonNodeId))
      );
      await db.insert(smaSchema).values({
        id: crypto.randomUUID(),
        courseId,
        userId,
        lessonNodeId,
        availabilityMode,
        availableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}