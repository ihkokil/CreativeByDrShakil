import { Prisma } from "@prisma/client";
import { sendTelegramEnrollmentNotification } from "./telegram";

/**
 * Ensures a student is enrolled in a specific course.
 */
export async function ensureCourseEnrollment(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null,
  enrolledByAdmin: boolean = false
) {
  // Enroll in the main course
  await tx.order.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId,
      },
    },
    update: {
      status: 'approved',
      updatedAt: new Date(), // Reset the 1-year clock
    },
    create: {
      userId,
      courseId,
      status: 'approved',
      totalAmount: 0,
    },
  });

  try {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true }
    });

    if (user) {
      await sendTelegramEnrollmentNotification({
        studentName: user.fullName,
        studentEmail: user.email,
        courseTitle,
        enrolledByAdmin,
      });
    }
  } catch (err) {
    console.error('Failed to send Telegram enrollment notification:', err);
  }
}

