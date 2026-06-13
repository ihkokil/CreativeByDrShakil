import { Prisma } from "@prisma/client";

/**
 * Titles of courses that, when purchased, also grant free access to the Basics course.
 */
export const CLINICAL_COURSE_TITLES = [
  'Medicine and Allied',
  'Surgery and Allied',
  'Gynae& Obstetrics',
  'Radiology',
  'Dermatology',
];

/**
 * Slugs of courses that, when purchased, also grant free access to the Basics course.
 */
export const CLINICAL_COURSE_SLUGS = [
  'medicine-and-allied',
  'surgery-and-allied',
  'gynae-and-obsetrics',
  'radiology',
  'dermatology',
];

/**
 * Ensures a student is enrolled in a specific course.
 * If the course is a clinical course, also ensures they are enrolled in the Basics course.
 */
export async function ensureCourseEnrollment(
  tx: Prisma.TransactionClient,
  userId: string,
  courseId: string,
  courseTitle: string,
  courseSlug: string | null
) {
  // 1. Enroll in the main course
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

  // 2. Check if Basics should be granted
  const isBasics = courseSlug === 'basics' || courseTitle.toLowerCase() === 'basics';
  const isClinical = CLINICAL_COURSE_SLUGS.includes(courseSlug || '') || CLINICAL_COURSE_TITLES.includes(courseTitle);

  if (isClinical && !isBasics) {
    const basicCourse = await tx.course.findFirst({
      where: {
        OR: [
          { slug: 'basics' },
          { title: 'Basics' }
        ],
      },
    });

    if (basicCourse) {
      await tx.order.upsert({
        where: {
          userId_courseId: {
            userId,
            courseId: basicCourse.id,
          },
        },
        update: {
          status: 'approved',
          updatedAt: new Date(), // Grant 1 year from now
        },
        create: {
          userId,
          courseId: basicCourse.id,
          status: 'approved',
          totalAmount: 0,
        },
      });
    }
  }
}
