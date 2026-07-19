/**
 * Common database query scoping helpers.
 * Because we have disabled RLS across all databases, all queries are executed
 * with Service Role (admin) privileges.
 * 
 * To prevent data leaks, you MUST use these helpers to securely scope queries
 * to the requesting user before executing them.
 */

/**
 * Scopes a Supabase query builder to only return rows belonging to a specific user.
 * Assumes the table has a `userId` column.
 * 
 * @example
 * const query = scopedToUser(supabase.from('Order').select('*'), payload.userId);
 * const { data } = await query;
 */
export function scopedToUser<T>(queryBuilder: any, userId: string) {
  if (!userId) throw new Error("scopedToUser requires a valid userId");
  return queryBuilder.eq('userId', userId);
}

/**
 * Scopes a Supabase query builder to only return rows belonging to a specific student.
 * Assumes the table has a `studentId` column (e.g., QuizAttempt).
 * 
 * @example
 * const query = scopedToStudent(supabase.from('QuizAttempt').select('*'), payload.userId);
 * const { data } = await query;
 */
export function scopedToStudent<T>(queryBuilder: any, studentId: string) {
  if (!studentId) throw new Error("scopedToStudent requires a valid studentId");
  return queryBuilder.eq('studentId', studentId);
}

/**
 * Scopes a Supabase query builder to only return PUBLISHED content.
 * Assumes the table has a `status` column matching CoursePublishStatus or similar.
 */
export function publishedOnly<T>(queryBuilder: any) {
  return queryBuilder.eq('status', 'PUBLISHED');
}

/**
 * Validates that an entity belongs to the user after fetching it.
 * Useful when looking up by a specific ID (e.g., `id = req.id`).
 */
export function verifyOwnership(entity: any, userId: string, idField: string = 'userId') {
  if (!entity) return false;
  return entity[idField] === userId;
}
