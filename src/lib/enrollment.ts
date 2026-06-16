import { Prisma } from "@prisma/client";

/**
 * Ensures a student is enrolled in a specific course.
 */
export async function ensureCourseEnrollment(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null
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
}

