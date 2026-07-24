import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: studentId, courseId } = await params;
    const supabase = getSupabaseAdmin();

    const [studentRes, courseRes, orderRes] = await Promise.all([
      supabase.from('User').select('id, fullName, email, profileImage').eq('id', studentId).limit(1).maybeSingle(),
      supabase.from('Course').select('*').eq('id', courseId).limit(1).maybeSingle(),
      supabase.from('Order').select('enrolledAt, updatedAt').eq('userId', studentId).eq('courseId', courseId).eq('status', 'approved').limit(1).maybeSingle(),
    ]);

    const student = studentRes.data as any;
    const course = courseRes.data as any;
    const order = orderRes.data as any;

    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    if (!order) return NextResponse.json({ error: 'Student is not enrolled in this course.' }, { status: 404 });

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    const studentReleaseStartAt = order.enrolledAt || course.releaseStartAt || course.courseStartDate || order.updatedAt;

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: studentReleaseStartAt,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: course.releaseDaysOfWeek as number[],
      releaseGroupDates,
    });

    // Fetch overrides for this student
    const { data: overrideRows = [] } = await supabase
      .from('StudentModuleAvailability')
      .select('lessonNodeId, availabilityMode, availableAt')
      .eq('courseId', courseId)
      .eq('userId', studentId);

    const overrides: LessonAvailabilityOverride[] = (overrideRows || []).map((row: any) => ({
      lessonNodeId: row.lessonNodeId,
      availabilityMode: row.availabilityMode,
      availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
    }));

    const annotatedCurriculum = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      new Date(),
      overrides
    );

    // Fetch progress
    const { data: progressRows = [] } = await supabase
      .from('LessonProgress')
      .select('lessonNodeId')
      .eq('userId', studentId)
      .eq('courseId', courseId);

    const completedIds = new Set((progressRows || []).map((r: any) => r.lessonNodeId));

    const markCompleted = (nodes: any[]): any[] =>
      nodes.map(node => ({
        ...node,
        completed: completedIds.has(node.id),
        children: node.children ? markCompleted(node.children) : undefined,
      }));

    const lessonNodes = collectVideoNodes(annotatedCurriculum);
    const completedCount = lessonNodes.filter((n: any) => completedIds.has(n.id)).length;

    return NextResponse.json({
      student,
      course: { id: course.id, title: course.title, slug: course.slug },
      curriculum: markCompleted(annotatedCurriculum),
      computedReleaseGroupDates,
      overrides: (overrideRows || []).map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      })),
      progress: {
        completedCount,
        totalCount: lessonNodes.length,
        percentage: lessonNodes.length > 0 ? Math.round((completedCount / lessonNodes.length) * 100) : 0,
      },
    });
  } catch (error: any) {
    console.error('[teacher/students/curriculum] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
