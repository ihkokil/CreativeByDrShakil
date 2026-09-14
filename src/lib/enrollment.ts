import { getSupabaseAdmin } from '@/lib/db';
import { nanoid } from '@/lib/nanoid';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  CourseReleaseModeValue,
} from '@/lib/teacher-course-builder';

export async function ensureCourseEnrollment(
  tx: any, // Ignore this for Supabase, pass null or whatever, since we use getSupabase internally
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null,
  enrolledByAdmin: boolean = false,
  enrolledAt?: Date,
  expiresAt?: Date,
  batchId?: string | null
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const dateStr = enrolledAt ? enrolledAt.toISOString() : new Date().toISOString();
  
  let finalEnrolledAt = enrolledAt ? enrolledAt.toISOString() : new Date().toISOString();
  let finalExpiresAt = expiresAt ? expiresAt.toISOString() : null;

  if (!batchId) {
    const customBatch = await ensureCustomBatch(supabase, courseId);
    batchId = customBatch.id;
  } else {
    const { data: batch } = await supabase
      .from('Batch')
      .select('id, name, startDate, endDate')
      .eq('id', batchId)
      .limit(1)
      .maybeSingle();

    if (batch) {
      const bName = (batch.name || '').toLowerCase();
      const isCustomOrInstant = bName.includes('start today') || bName.includes('custom') || bName.includes('all unlocked') || bName.includes('instant');
      if (!isCustomOrInstant && batch.startDate) {
        finalEnrolledAt = batch.startDate;
        if (!expiresAt) {
          if (batch.endDate) {
            finalExpiresAt = batch.endDate;
          } else {
            const exp = new Date(finalEnrolledAt);
            exp.setFullYear(exp.getFullYear() + 1);
            finalExpiresAt = exp.toISOString();
          }
        }
      }
    }
  }

  if (!finalExpiresAt) {
    const exp = new Date(finalEnrolledAt);
    exp.setFullYear(exp.getFullYear() + 1);
    finalExpiresAt = exp.toISOString();
  }

  // Create order for the course
  const { data: existingOrder } = await supabase
    .from('Order')
    .select('id')
    .eq('userId', userId)
    .eq('courseId', courseId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();
    
  if (!existingOrder) {
    const orderId = nanoid();
    const { error } = await supabase.from('Order').insert({
      id: orderId,
      userId,
      courseId,
      batchId,
      totalAmount: 0,
      status: 'approved',
      enrolledAt: finalEnrolledAt,
      expiresAt: finalExpiresAt,
      createdAt: dateStr,
      updatedAt: dateStr,
    } as any);

    if (error) {
      console.error('[ensureCourseEnrollment] Error inserting order:', error);
      throw new Error(`Failed to insert order: ${error.message}`);
    }
  } else {
    await (supabase.from('Order') as any).update({
      batchId,
      enrolledAt: finalEnrolledAt,
      expiresAt: finalExpiresAt,
      updatedAt: new Date().toISOString(),
    } as any).eq('id', existingOrder.id);
  }

  // Handle basics bundle logic if the title is "Basics" or something similar
  if (courseTitle && courseTitle.toLowerCase().includes('basic')) {
    // Stub or logic for basics, not critical for Drizzle purge unless specified elsewhere
  }
}

export async function ensureCustomBatch(supabase: any, courseId: string) {
  // Check for 'Start Today Batch' or legacy 'Custom Batch'
  const { data: existing } = await supabase
    .from('Batch')
    .select('id, name, startDate, endDate')
    .eq('courseId', courseId)
    .or('name.ilike.Start Today Batch,name.ilike.Custom Batch')
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const nowStr = new Date().toISOString();
  const newBatch = {
    id: crypto.randomUUID(),
    name: 'Start Today Batch',
    courseId,
    startDate: null,
    endDate: null,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await supabase.from('Batch').insert(newBatch as any);
  return newBatch;
}

export const ensureStartTodayBatch = ensureCustomBatch;

export async function ensureInstantBatch(supabase: any, courseId: string) {
  // Check for 'All Unlocked Batch' or legacy 'Instant Batch'
  const { data: existing } = await supabase
    .from('Batch')
    .select('id, name, startDate, endDate')
    .eq('courseId', courseId)
    .or('name.ilike.All Unlocked Batch,name.ilike.Instant Batch')
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const nowStr = new Date().toISOString();
  const newBatch = {
    id: crypto.randomUUID(),
    name: 'All Unlocked Batch',
    courseId,
    startDate: null,
    endDate: null,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await supabase.from('Batch').insert(newBatch as any);
  return newBatch;
}

export const ensureAllUnlockedBatch = ensureInstantBatch;

export async function ensureDefaultBatches(supabase: any, courseId: string) {
  const customBatch = await ensureCustomBatch(supabase, courseId);
  const instantBatch = await ensureInstantBatch(supabase, courseId);
  return { customBatch, instantBatch, startTodayBatch: customBatch, allUnlockedBatch: instantBatch };
}

export interface ApplyScheduleRuleParams {
  supabase: any;
  courseId: string;
  userIds: string[];
  action: 'fixed_interval' | 'groups_per_week' | 'day_of_week' | 'current_batch' | 'instant' | 'custom_batch';
  intervalDays?: number;
  groupsPerWeek?: number;
  daysOfWeek?: number[];
  startDate?: string | Date;
}

export async function applyStudentScheduleRule({
  supabase,
  courseId,
  userIds,
  action,
  intervalDays,
  groupsPerWeek,
  daysOfWeek,
  startDate,
}: ApplyScheduleRuleParams): Promise<{ success: boolean; processed: number }> {
  if (!courseId || !userIds || userIds.length === 0) {
    return { success: true, processed: 0 };
  }

  // 1. Current Batch (Default): remove all StudentModuleAvailability overrides so they inherit the batch schedule
  if (action === 'current_batch') {
    for (const uid of userIds) {
      await supabase
        .from('StudentModuleAvailability')
        .delete()
        .eq('courseId', courseId)
        .eq('userId', uid);
    }
    return { success: true, processed: userIds.length };
  }

  // 2. Instant: assign to All Unlocked Batch and clear overrides
  if (action === 'instant') {
    const allUnlockedBatch = await ensureAllUnlockedBatch(supabase, courseId);
    for (const uid of userIds) {
      await (supabase.from('Order') as any)
        .update({
          batchId: allUnlockedBatch.id,
          updatedAt: new Date().toISOString(),
        } as any)
        .eq('courseId', courseId)
        .eq('userId', uid)
        .in('status', ['approved', 'completed']);

      await supabase
        .from('StudentModuleAvailability')
        .delete()
        .eq('courseId', courseId)
        .eq('userId', uid);
    }
    return { success: true, processed: userIds.length };
  }

  // 3. Schedule rules: 'fixed_interval' | 'groups_per_week' | 'day_of_week' | 'custom_batch'
  const { data: course } = await supabase
    .from('Course')
    .select('id, curriculumJson, releaseMode, releaseIntervalDays, releaseGroupsPerWeek, releaseDaysOfWeek, releaseGroupDates, releaseStartAt, courseStartDate')
    .eq('id', courseId)
    .limit(1)
    .maybeSingle();

  if (!course) {
    throw new Error('Course not found.');
  }

  const rawCurriculum = parseCurriculumJson(course.curriculumJson);
  const curriculum = ensureGroupInheritance(rawCurriculum);
  const groups = collectSecondChildGroups(curriculum);

  if (groups.length === 0) {
    return { success: true, processed: userIds.length };
  }

  // Put students into "Start Today Batch" so their personal schedule is isolated
  const customBatch = await ensureCustomBatch(supabase, courseId);

  // Fallback daysOfWeek from course
  let courseDaysOfWeek: number[] = [0];
  if (course.releaseDaysOfWeek) {
    if (Array.isArray(course.releaseDaysOfWeek)) {
      courseDaysOfWeek = course.releaseDaysOfWeek;
    } else if (typeof course.releaseDaysOfWeek === 'string') {
      try {
        courseDaysOfWeek = JSON.parse(course.releaseDaysOfWeek);
      } catch {
        courseDaysOfWeek = [0];
      }
    }
  }

  const effectiveDaysOfWeek = (daysOfWeek && daysOfWeek.length > 0) ? daysOfWeek : courseDaysOfWeek;
  const effectiveIntervalDays = intervalDays || course.releaseIntervalDays || 3;
  const effectiveGroupsPerWeek = groupsPerWeek || course.releaseGroupsPerWeek || 1;

  for (const uid of userIds) {
    // Determine the student's start date
    let studentStartDate: Date;
    if (startDate) {
      studentStartDate = new Date(startDate);
    } else {
      const { data: order } = await supabase
        .from('Order')
        .select('enrolledAt, createdAt')
        .eq('courseId', courseId)
        .eq('userId', uid)
        .in('status', ['approved', 'completed'])
        .order('createdAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawDate = order?.enrolledAt || order?.createdAt;
      studentStartDate = rawDate ? new Date(rawDate) : new Date();
    }

    if (Number.isNaN(studentStartDate.getTime())) {
      studentStartDate = new Date();
    }

    const isoStart = studentStartDate.toISOString();
    const expDate = new Date(studentStartDate);
    expDate.setFullYear(expDate.getFullYear() + 1);
    const isoExp = expDate.toISOString();

    // Update order with batchId and enrolledAt
    await (supabase.from('Order') as any)
      .update({
        batchId: customBatch.id,
        enrolledAt: isoStart,
        expiresAt: isoExp,
        updatedAt: new Date().toISOString(),
      } as any)
      .eq('courseId', courseId)
      .eq('userId', uid)
      .in('status', ['approved', 'completed']);

    // Compute release dates for each group
    const computedDates = computeReleaseGroupDates(groups, {
      releaseMode: action as CourseReleaseModeValue,
      releaseStartAt: studentStartDate,
      releaseIntervalDays: effectiveIntervalDays,
      releaseGroupsPerWeek: effectiveGroupsPerWeek,
      releaseDaysOfWeek: effectiveDaysOfWeek,
      releaseGroupDates: parseReleaseGroupDateMap(course.releaseGroupDates),
    });

    // Delete existing overrides for this course and student
    await supabase
      .from('StudentModuleAvailability')
      .delete()
      .eq('courseId', courseId)
      .eq('userId', uid);

    // Prepare rows to insert
    const nowStr = new Date().toISOString();
    const rowsToInsert: any[] = [];

    for (const g of groups) {
      const unlockAt = computedDates[g.id];
      if (!unlockAt) continue;

      // Insert for the main topic node ID
      rowsToInsert.push({
        id: crypto.randomUUID(),
        courseId,
        userId: uid,
        lessonNodeId: g.nodeId,
        availabilityMode: 'available',
        availableAt: unlockAt,
        createdAt: nowStr,
        updatedAt: nowStr,
      });

      // If releaseGroupId is different from nodeId, insert that as well for complete lookup compatibility
      if (g.id && g.id !== g.nodeId) {
        rowsToInsert.push({
          id: crypto.randomUUID(),
          courseId,
          userId: uid,
          lessonNodeId: g.id,
          availabilityMode: 'available',
          availableAt: unlockAt,
          createdAt: nowStr,
          updatedAt: nowStr,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('StudentModuleAvailability')
        .insert(rowsToInsert as any);
      if (insertErr) {
        console.error('[applyStudentScheduleRule] Error inserting availability:', insertErr);
        throw insertErr;
      }
    }
  }

  return { success: true, processed: userIds.length };
}


