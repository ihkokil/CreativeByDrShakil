import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseDisplayDateToIso } from '@/lib/date-format';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.releaseMode !== undefined) {
      const validModes = ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant', 'circular', null];
      if (!validModes.includes(body.releaseMode)) {
        return NextResponse.json({ error: 'Invalid release mode.' }, { status: 400 });
      }
      updateData.releaseMode = body.releaseMode === 'circular' ? null : body.releaseMode;
    }

    if (body.releaseStartAt !== undefined) {
      const parsed = typeof body.releaseStartAt === 'string' ? parseDisplayDateToIso(body.releaseStartAt) : null;
      updateData.releaseStartAt = parsed ? new Date(parsed).toISOString() : null;
    }

    if (body.releaseIntervalDays !== undefined) {
      const parsed = Number(body.releaseIntervalDays);
      updateData.releaseIntervalDays = Number.isNaN(parsed) ? null : Math.max(1, Math.floor(parsed));
    }

    if (body.releaseGroupsPerWeek !== undefined) {
      const parsed = Number(body.releaseGroupsPerWeek);
      updateData.releaseGroupsPerWeek = parsed === 3 ? 3 : parsed === 2 ? 2 : null;
    }

    if (body.releaseDaysOfWeek !== undefined) {
      if (body.releaseDaysOfWeek !== null && (!Array.isArray(body.releaseDaysOfWeek) || body.releaseDaysOfWeek.some((d: any) => typeof d !== 'number' || d < 0 || d > 6))) {
        return NextResponse.json({ error: 'releaseDaysOfWeek must be an array of numbers (0-6).' }, { status: 400 });
      }
      updateData.releaseDaysOfWeek = body.releaseDaysOfWeek ? JSON.stringify(body.releaseDaysOfWeek) : null;
    }

    if (body.releaseGroupDates !== undefined) {
      updateData.releaseGroupDates = body.releaseGroupDates ? JSON.stringify(body.releaseGroupDates) : null;
    }

    if (body.courseStartDate !== undefined) {
      const parsed = typeof body.courseStartDate === 'string' ? parseDisplayDateToIso(body.courseStartDate) : null;
      updateData.courseStartDate = parsed ? new Date(parsed).toISOString() : null;
    }

    const { error: updateError } = await supabase
      .from('Course')
      // @ts-ignore
      .update(updateData)
      .eq('id', courseId);

    if (updateError) throw updateError;

    const { data: updatedCourse } = await supabase
      .from('Course')
      .select('id, releaseMode, releaseStartAt, releaseIntervalDays, releaseGroupsPerWeek, releaseDaysOfWeek, releaseGroupDates, courseStartDate')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ success: true, course: updatedCourse });
  } catch (error: any) {
    console.error('[teacher/scheduling] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
