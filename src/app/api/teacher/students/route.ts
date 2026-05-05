import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
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

const OVERRIDE_TABLE = 'StudentModuleAvailability';

type TeacherCourseSummary = {
  id: string;
  slug: string | null;
  title: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  duration: string;
  imageUrl: string | null;
  category: { displayName: string } | null;
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

const getTeacherCourses = async (teacherId: string, role: string) => {
  return prisma.course.findMany({
    where: {},
    orderBy: { updatedAt: 'desc' },
    include: {
      category: true,
      instructors: { orderBy: { sortOrder: 'asc' } },
      _count: {
        select: {
          orders: true,
        },
      },
    },
  }) as Promise<TeacherCourseSummary[]>;
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
      category: { displayName: string } | null;
    }

    const selectedCourse = await prisma.course.findFirst({
      where: { id: selectedCourseId },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        duration: true,
        imageUrl: true,
        releaseMode: true,
        releaseStartAt: true,
        releaseIntervalDays: true,
        releaseGroupsPerWeek: true,
        ...({ releaseDaysOfWeek: true } as any),
        releaseGroupDates: true,
        curriculumJson: true,
        courseStartDate: true,
        category: {
          select: { displayName: true },
        },
      },
    }) as CourseResult | null;

    if (!selectedCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const enrollments = await prisma.order.findMany({
      where: {
        courseId: selectedCourse.id,
        status: 'approved',
        updatedAt: {
          gte: oneYearAgo,
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    const userIds = enrollments.map((enrollment) => enrollment.user.id);
    let progressRows: ProgressRow[] = [];
    let overrideRows: OverrideRow[] = [];

    // Safely query LessonProgress if it exists
    if (userIds.length > 0) {
      try {
        const lpResult = await prisma.lessonProgress.findMany({
          where: { courseId: selectedCourse.id, userId: { in: userIds } },
          select: { userId: true, lessonNodeId: true }
        });
        progressRows = lpResult;
      } catch (err) {
        console.warn('LessonProgress query failed', err);
        progressRows = [];
      }

      // Safely query StudentModuleAvailability if it exists
      try {
        const smaResult = await prisma.studentModuleAvailability.findMany({
          where: { courseId: selectedCourse.id, userId: { in: userIds } },
          select: { userId: true, lessonNodeId: true, availabilityMode: true, availableAt: true }
        });
        overrideRows = smaResult as OverrideRow[];
      } catch (err) {
        console.warn('StudentModuleAvailability query failed', err);
        overrideRows = [];
      }
    }

    const curriculum = ensureGroupInheritance(parseCurriculumJson(selectedCourse.curriculumJson));
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
      const studentReleaseStartAt = courseAnchor && enrollment.updatedAt
        ? new Date(Math.max(courseAnchor.getTime(), enrollment.updatedAt.getTime()))
        : courseAnchor || enrollment.updatedAt;

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
        enrolledAt: enrollment.updatedAt.toISOString(),
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

    const course = await prisma.course.findFirst({
      where: { id: courseId },
      select: { id: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (!['inherit', 'available', 'locked'].includes(availabilityMode)) {
      return NextResponse.json({ error: 'Invalid availability mode.' }, { status: 400 });
    }

    if (availabilityMode === 'inherit') {
      await prisma.studentModuleAvailability.deleteMany({
        where: { courseId, userId, lessonNodeId }
      });
    } else {
      const nextAvailableAt = availableAt && !Number.isNaN(availableAt.getTime()) ? availableAt : null;

      await prisma.studentModuleAvailability.upsert({
        where: {
          courseId_userId_lessonNodeId: {
            courseId,
            userId,
            lessonNodeId
          }
        },
        update: {
          availabilityMode,
          availableAt: nextAvailableAt
        },
        create: {
          courseId,
          userId,
          lessonNodeId,
          availabilityMode,
          availableAt: nextAvailableAt
        }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}