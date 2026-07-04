import { sendTelegramEnrollmentNotification } from "./telegram";
import { Prisma } from "@prisma/client";

/**
 * Ensures a student is enrolled in a specific course.
 * @param tx The Prisma transaction (or db) instance.
 */
export async function ensureCourseEnrollment(
  tx: any, // Accepts Prisma client or transaction
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

  const existingOrder = await tx.order.findUnique({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    }
  });

  if (existingOrder) {
    await tx.order.update({
      where: { id: existingOrder.id },
      data: {
        status: 'approved',
        enrolledAt: finalEnrolledAt,
        expiresAt: finalExpiresAt,
      }
    });
  } else {
    await tx.order.create({
      data: {
        userId,
        courseId,
        status: 'approved',
        totalAmount: 0,
        enrolledAt: finalEnrolledAt,
        expiresAt: finalExpiresAt,
      }
    });
  }

  try {
    const userRecord = await tx.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true }
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
