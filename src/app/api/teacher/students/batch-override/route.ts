import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { ensureCustomBatch, ensureAllUnlockedBatch, applyStudentScheduleRule } from '@/lib/enrollment';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, overrides } = body;

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { action, userId, userIds, startDate } = body;

    // Determine target users
    let targets: string[] = [];
    if (userId) targets.push(userId);
    if (userIds && Array.isArray(userIds)) targets.push(...userIds);
    if (targets.length === 0) {
      // If handling old style overrides
      if (!Array.isArray(body.overrides)) {
        return NextResponse.json({ error: 'User target or overrides array is required.' }, { status: 400 });
      }
    }

    if (action) {
      if (action === 'current_batch' || action === 'start_from_today') {
        const result = await applyStudentScheduleRule({
          supabase,
          courseId,
          userIds: targets,
          action: 'current_batch',
        });
        return NextResponse.json(result);
      }

      if (action === 'custom_date') {
        const { data: courseInfo } = await supabase
          .from('Course')
          .select('releaseMode')
          .eq('id', courseId)
          .limit(1)
          .maybeSingle();

        const courseMode = courseInfo?.releaseMode;
        const releaseMode = (courseMode && ['fixed_interval', 'groups_per_week', 'day_of_week'].includes(courseMode))
          ? courseMode
          : 'custom_batch';

        const result = await applyStudentScheduleRule({
          supabase,
          courseId,
          userIds: targets,
          action: releaseMode as any,
          startDate,
        });
        return NextResponse.json(result);
      }
      
      if (action === 'instant' || action === 'unlock_all') {
        const result = await applyStudentScheduleRule({
          supabase,
          courseId,
          userIds: targets,
          action: 'instant',
        });
        return NextResponse.json(result);
      }
      
      if (action === 'batch_change' || action === 'change_batch') {
        let { batchId, startDate } = body;
        if (!batchId) {
          const customBatch = await ensureCustomBatch(supabase, courseId);
          batchId = customBatch.id;
        }

        const { data: batch } = await supabase
          .from('Batch')
          .select('id, name, startDate, endDate')
          .eq('id', batchId)
          .limit(1)
          .maybeSingle();

        const updateData: any = { batchId };
        const bName = (batch?.name || '').toLowerCase();
        const isCustomOrInstant = bName.includes('start today') || bName.includes('custom') || bName.includes('all unlocked') || bName.includes('instant');

        if (!isCustomOrInstant && batch?.startDate) {
          updateData.enrolledAt = batch.startDate;
          if (batch.endDate) {
            updateData.expiresAt = batch.endDate;
          } else {
            const exp = new Date(batch.startDate);
            exp.setFullYear(exp.getFullYear() + 1);
            updateData.expiresAt = exp.toISOString();
          }
        } else if (startDate) {
          updateData.enrolledAt = startDate;
          const exp = new Date(startDate);
          exp.setFullYear(exp.getFullYear() + 1);
          updateData.expiresAt = exp.toISOString();
        }

        for (const uid of targets) {
          await (supabase.from('Order') as any)
            .update(updateData as any)
            .eq('courseId', courseId)
            .eq('userId', uid)
            .in('status', ['approved', 'completed']);

          // Clear student module overrides when moving to a new batch
          await supabase
            .from('StudentModuleAvailability')
            .delete()
            .eq('courseId', courseId)
            .eq('userId', uid);
        }
        return NextResponse.json({ success: true, processed: targets.length });
      }

      if (action === 'fixed_interval' || action === 'custom_interval' || action === 'groups_per_week' || action === 'day_of_week' || action === 'week_days') {
        const normalizedAction = (
          action === 'custom_interval' ? 'fixed_interval' :
          action === 'week_days' ? 'day_of_week' :
          action
        ) as any;

        const result = await applyStudentScheduleRule({
          supabase,
          courseId,
          userIds: targets,
          action: normalizedAction,
          intervalDays: body.intervalDays ? Number(body.intervalDays) : undefined,
          groupsPerWeek: body.groupsPerWeek ? Number(body.groupsPerWeek) : undefined,
          daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : undefined,
          startDate: body.startDate,
        });
        return NextResponse.json(result);
      }
      
      // Fallback for unsupported actions
      return NextResponse.json({ error: 'Unsupported action type.' }, { status: 400 });
    }

    // Handle legacy overrides array format
    if (!Array.isArray(overrides)) {
      return NextResponse.json({ error: 'overrides must be an array.' }, { status: 400 });
    }

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    let processed = 0;

    for (const override of overrides) {
      const { userId, lessonNodeId, availabilityMode, availableAt } = override;

      if (!userId || !lessonNodeId) continue;

      if (availabilityMode === 'inherit') {
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);
      } else {
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);

        const nowStr = new Date().toISOString();
        const { error: insertError } = await supabase.from('StudentModuleAvailability')
// @ts-ignore
.insert({
          id: crypto.randomUUID(),
          courseId,
          userId,
          lessonNodeId,
          availabilityMode: availabilityMode || 'available',
          availableAt: availableAt ? new Date(availableAt).toISOString() : null,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);
        if (insertError) throw insertError;
      }
      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error('[teacher/students/batch-override] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
