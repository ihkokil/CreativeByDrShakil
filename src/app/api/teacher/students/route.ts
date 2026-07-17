import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
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

const getTeacherCourses = async (teacherId: string, role: string, supabase: any) => {
  const { data: rawCourses = [] } = await supabase
    .from('Course')
    .select('*')
    .order('updatedAt', { ascending: false });

  const courseIds = (rawCourses || []).map((c: any) => c.id);
  
  let orderCountsData: any[] = [];
  let instructors = [];

  if (courseIds.length > 0) {
    const { data: ordersData = [] } = await supabase
      .from('Order')
      .select('id, courseId')
      .eq('status', 'approved')
      .in('courseId', courseIds);

    const counts = (ordersData || []).reduce((acc: any, order: any) => {
      acc[order.courseId] = (acc[order.courseId] || 0) + 1;
      return acc;
    }, {});
    
    orderCountsData = Object.keys(counts).map(id => ({ courseId: id, count: counts[id] }));

    const { data: instData = [] } = await supabase
      .from('CourseInstructor')
      .select('*')
      .in('courseId', courseIds)
      .order('sortOrder', { ascending: true });
    instructors = instData || [];
  }

  const instructorsMap = new Map<string, typeof instructors[number][]>();
  for (const inst of instructors) {
    const list = instructorsMap.get(inst.courseId) || [];
    list.push(inst);
    instructorsMap.set(inst.courseId, list);
  }

  const orderCountMap = new Map(orderCountsData.map((row: any) => [row.courseId as string, row.count]));

  return (rawCourses || []).map((c: any) => ({
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

    const supabase = getSupabase();
    const courseIdParam = request.nextUrl.searchParams.get('courseId');
    const teacherCourses = await getTeacherCourses(payload.sub, payload.role, supabase);

    if (teacherCourses.length === 0) {
      return NextResponse.json({ courses: [], selectedCourse: null, students: [], curriculum: [], overrides: [] });
    }

    const selectedCourseId = courseIdParam && teacherCourses.some((course) => course.id === courseIdParam)
      ? courseIdParam
      : teacherCourses[0].id;

    const { data: selectedCourse } = await supabase
      .from('Course')
      .select('id, title, slug, status, duration, imageUrl, releaseMode, releaseStartAt, releaseIntervalDays, releaseGroupsPerWeek, releaseDaysOfWeek, releaseGroupDates, curriculumJson, courseStartDate')
      .eq('id', selectedCourseId)
      .limit(1)
      .maybeSingle();

    if (!selectedCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const { data: enrollmentsData = [] } = await supabase
      .from('Order')
      .select('*')
      .eq('courseId', (selectedCourse as any).id)
      .eq('status', 'approved')
      .gte('updatedAt', oneYearAgo.toISOString())
      .order('updatedAt', { ascending: false });

    const orderUserIds = [...new Set((enrollmentsData || []).map((o: any) => o.userId).filter(Boolean))];
    const users = orderUserIds.length > 0
      ? await supabase.from('User').select('id, fullName, email, profileImage').in('id', orderUserIds).then(r => r.data || [])
      : [];
    const usersMap = new Map(users.map((u: any) => [u.id, u]));
    const enrollments = (enrollmentsData || []).map((o: any) => ({ ...o, user: usersMap.get(o.userId)! }));

    const userIds = (enrollmentsData || []).map((o: any) => o.userId);
    let progressRows: ProgressRow[] = [];
    let overrideRows: OverrideRow[] = [];

    if (userIds.length > 0) {
      try {
        const { data: lpResult = [] } = await supabase
          .from('LessonProgress')
          .select('userId, lessonNodeId')
          .eq('courseId', (selectedCourse as any).id)
          .in('userId', userIds);
        progressRows = lpResult || [];
      } catch (err) {
        console.warn('LessonProgress query failed', err);
        progressRows = [];
      }

      try {
        const { data: smaResult = [] } = await supabase
          .from('StudentModuleAvailability')
          .select('userId, lessonNodeId, availabilityMode, availableAt')
          .eq('courseId', (selectedCourse as any).id)
          .in('userId', userIds);
        overrideRows = (smaResult || []) as OverrideRow[];
      } catch (err) {
        console.warn('StudentModuleAvailability query failed', err);
        overrideRows = [];
      }
    }

    const rawCurriculum = parseCurriculumJson((selectedCourse as any).curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap((selectedCourse as any).releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
        releaseMode: (selectedCourse as any).releaseMode as any,
        releaseStartAt: (selectedCourse as any).releaseStartAt,
        releaseIntervalDays: (selectedCourse as any).releaseIntervalDays,
        releaseGroupsPerWeek: (selectedCourse as any).releaseGroupsPerWeek,
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
      
      const courseAnchor = (selectedCourse as any).releaseStartAt || (selectedCourse as any).courseStartDate || null;
      const studentReleaseStartAt = courseAnchor || enrollment.enrolledAt || enrollment.updatedAt;

      const studentComputedDates = computeReleaseGroupDates(groups, {
        releaseMode: (selectedCourse as any).releaseMode as any,
        releaseStartAt: studentReleaseStartAt,
        releaseIntervalDays: (selectedCourse as any).releaseIntervalDays,
        releaseGroupsPerWeek: (selectedCourse as any).releaseGroupsPerWeek,
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
        ...(selectedCourse as any),
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

    const supabase = getSupabase();
    const { data: course } = await supabase.from('Course').select('id').eq('id', courseId).limit(1).maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (!['inherit', 'available', 'locked'].includes(availabilityMode)) {
      return NextResponse.json({ error: 'Invalid availability mode.' }, { status: 400 });
    }

    if (availabilityMode === 'inherit') {
      await supabase.from('StudentModuleAvailability')
        .delete()
        .eq('courseId', courseId)
        .eq('userId', userId)
        .eq('lessonNodeId', lessonNodeId);
    } else {
      const nextAvailableAt = availableAt && !Number.isNaN(availableAt.getTime()) ? availableAt : null;

      await supabase.from('StudentModuleAvailability')
        .delete()
        .eq('courseId', courseId)
        .eq('userId', userId)
        .eq('lessonNodeId', lessonNodeId);
        
      await supabase.from('StudentModuleAvailability').insert({
        id: crypto.randomUUID(),
        courseId,
        userId,
        lessonNodeId,
        availabilityMode,
        availableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
      } as any);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}