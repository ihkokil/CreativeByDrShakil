export async function ensureCourseEnrollment(
  tx: any,
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null,
  enrolledByAdmin: boolean = false,
  enrolledAt?: Date,
  expiresAt?: Date
): Promise<void> {
  // TODO(supabase-migration): Phase 3 — stubbed during Drizzle purge
  throw new Error('Route not yet migrated to Supabase');
}
