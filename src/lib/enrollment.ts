import { sendTelegramEnrollmentNotification } from "./telegram";
import { order, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Ensures a student is enrolled in a specific course.
 * @param tx The Drizzle transaction (or db) instance.
 */
export async function ensureCourseEnrollment(
  tx: any,
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null,
  enrolledByAdmin: boolean = false,
  enrolledAt?: Date,
  expiresAt?: Date
) {
  const finalEnrolledAt = enrolledAt || new Date();
  const finalExpiresAt = expiresAt || new Date(finalEnrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);

  // Drizzle doesn't have a direct upsert that matches multiple unique constraints nicely without raw queries
  // For 'order', the unique constraint is on userId and courseId. Let's check first, then insert or update.
  const existingOrder = await tx.query.order.findFirst({
    where: (o: any, { eq, and }: any) => and(eq(o.userId, userId), eq(o.courseId, courseId))
  });

  if (existingOrder) {
    await tx.update(order)
      .set({
        status: 'approved',
        enrolledAt: finalEnrolledAt.toISOString(),
        expiresAt: finalExpiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(order.id, existingOrder.id));
  } else {
    await tx.insert(order).values({
      id: crypto.randomUUID(),
      userId,
      courseId,
      status: 'approved',
      totalAmount: 0,
      enrolledAt: finalEnrolledAt.toISOString(),
      expiresAt: finalExpiresAt.toISOString(),
    });
  }

  try {
    const userRecord = await tx.query.user.findFirst({
      where: (u: any, { eq }: any) => eq(u.id, userId),
      columns: { fullName: true, email: true }
    });

    if (userRecord) {
      await sendTelegramEnrollmentNotification({
        studentName: userRecord.fullName,
        studentEmail: userRecord.email,
        courseTitle,
        enrolledByAdmin,
      });
    }
  } catch (err) {
    console.error('Failed to send Telegram enrollment notification:', err);
  }
}
