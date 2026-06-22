import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { countLessons, parseCurriculumJson } from '@/lib/teacher-course-builder';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const courses = await db.query.course.findMany({
      where: (c, { eq, isNotNull, and }) => and(
        eq(c.status, 'published'),
        isNotNull(c.slug)
      ),
      orderBy: (c, { desc }) => [desc(c.publishedAt), desc(c.updatedAt)],
      with: {
        teacher: {
          columns: {
            id: true,
            fullName: true,
            designation: true,
            profileImage: true,
          },
        },
        instructors: {
          orderBy: (i, { asc }) => [asc(i.sortOrder)],
          columns: {
            id: true,
            name: true,
            designation: true,
            imageUrl: true,
            sortOrder: true,
          },
        },
        orders: {
          where: (o, { eq }) => eq(o.status, 'approved'),
          columns: {
            id: true,
          },
        },
      },
    });

    return NextResponse.json({
      courses: courses.map((course) => {
        const curriculum = parseCurriculumJson(course.curriculumJson);
        const lessonCount = countLessons(curriculum);

        return {
          id: course.id,
          slug: course.slug,
          title: course.title,
          price: formatPrice(course.price),
          salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
          priceValue: course.price,
          duration: course.duration,
          lessonCount,
          enrolledCount: course.orders.length,
          isFeatured: course.isFeatured,
          description: course.overview || course.description,
          overview: course.overview,
          learningOutcomes: course.learningOutcomes,
          language: course.language || 'English / Bengali',
          image: course.imageUrl,
          status: course.status,
          publishedAt: course.publishedAt,
          instructors: course.instructors,
          mainInstructor: {
            id: course.teacher?.id || `teacher-${course.id}`,
            name: course.teacher?.fullName || course.instructor,
            role: course.teacher?.designation || 'Course Instructor',
            image: course.teacher?.profileImage || '/placeholder-square.svg',
          },
        };
      }),
    });
  } catch (error: any) {
    console.error('[Courses Dynamic Error]', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });
    return NextResponse.json(
      { error: 'Failed to load courses. Please try again.' },
      { status: 500 }
    );
  }
}

