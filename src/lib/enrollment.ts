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
  const { data: existing } = await supabase
    .from('Batch')
    .select('id, name, startDate, endDate')
    .eq('courseId', courseId)
    .ilike('name', 'Custom Batch')
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const nowStr = new Date().toISOString();
  const futureEnd = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  const newBatch = {
    id: crypto.randomUUID(),
    name: 'Custom Batch',
    courseId,
    startDate: nowStr,
    endDate: futureEnd,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  await supabase.from('Batch').insert(newBatch as any);
  return newBatch;
}
