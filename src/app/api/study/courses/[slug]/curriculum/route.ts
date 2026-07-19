import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';
import {
  annotateCurriculumAvailability,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { slug } = await params;
    const token = await extractCookieToken();

    const supabase = getSupabase(token);

    const { data: course, error: courseError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('*')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // For admin, show everything without restrictions
    const isAdmin = payload.role === 'admin';

    // Get the student's enrollment
    let enrolledAt: string | null = null;
    if (!isAdmin) {
      const { data: order }: { data: any } = await supabase
        .from('Order')
        .select('enrolledAt, updatedAt')
        .eq('userId', payload.sub)
        .eq('courseId', course.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
      }
      enrolledAt = order.enrolledAt || order.updatedAt;
    }

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculum = ensureGroupInheritance(populatedCurriculum);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    // Compute release dates
    const courseAnchor = course.releaseStartAt || course.courseStartDate || null;
    const releaseStart = isAdmin ? courseAnchor : (courseAnchor || enrolledAt);

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: releaseStart,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: course.releaseDaysOfWeek as number[],
      releaseGroupDates,
    });

    // Fetch student-specific overrides
    let overrides: any[] = [];
    if (!isAdmin) {
      const { data: overrideRows = [] } = await supabase
        .from('StudentModuleAvailability')
        .select('lessonNodeId, availabilityMode, availableAt')
        .eq('courseId', course.id)
        .eq('userId', payload.sub);

      overrides = (overrideRows || []).map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      }));
    }

    const annotatedCurriculum = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      new Date(),
      overrides
    );

    // Get progress
    const { data: progressRows = [] } = await supabase
      .from('LessonProgress')
      .select('lessonNodeId')
      .eq('userId', payload.sub)
      .eq('courseId', course.id);

    const completedIds = new Set((progressRows || []).map((r: any) => r.lessonNodeId));

    // Mark completed nodes
    const markCompleted = (nodes: any[]): any[] =>
      nodes.map(node => ({
        ...node,
        completed: completedIds.has(node.id),
        children: node.children ? markCompleted(node.children) : undefined,
      }));

    return NextResponse.json({
      courseId: course.id,
      curriculum: markCompleted(annotatedCurriculum),
    });
  } catch (error: any) {
    console.error('[study/curriculum] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
