import { sendTelegramEnrollmentNotification } from "./telegram";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";
import { createId } from '@paralleldrive/cuid2';

/**
 * Ensures a student is enrolled in a specific course.
 * @param tx The Drizzle instance.
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

  const existingOrder = await tx.query.orders.findFirst({
    where: and(eq(schema.orders.userId, userId), eq(schema.orders.courseId, courseId))
  });

  if (existingOrder) {
    await tx.update(schema.orders).set({
      status: 'approved',
      enrolledAt: finalEnrolledAt,
      expiresAt: finalExpiresAt,
    }).where(eq(schema.orders.id, existingOrder.id));
  } else {
    await tx.insert(schema.orders).values({
      id: createId(),
      userId,
      courseId,
      status: 'approved',
      totalAmount: 0,
      enrolledAt: finalEnrolledAt,
      expiresAt: finalExpiresAt,
    });
  }

  try {
    const userRecord = await tx.query.users.findFirst({
      where: eq(schema.users.id, userId),
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
