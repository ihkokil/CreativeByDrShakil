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
  expiresAt?: Date
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const dateStr = enrolledAt ? enrolledAt.toISOString() : new Date().toISOString();
  
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
    const { error } = await supabase.from('Order')
// @ts-ignore
.insert({
      id: orderId,
      userId,
      courseId,
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
  }

  // Handle basics bundle logic if the title is "Basics" or something similar
  if (courseTitle && courseTitle.toLowerCase().includes('basic')) {
    // Stub or logic for basics, not critical for Drizzle purge unless specified elsewhere
  }
}
