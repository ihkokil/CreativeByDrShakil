import { getSupabaseAdmin } from '@/lib/db';
import { nanoid } from '@/lib/nanoid';

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
  
  if (!batchId) {
    const customBatch = await ensureCustomBatch(supabase, courseId);
    batchId = customBatch.id;
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
      enrolledAt: dateStr,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
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
      enrolledAt: dateStr,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
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

