import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

import { course as courseSchema, user as userSchema } from '@/db/schema';
import { eq, and, isNotNull, desc } from 'drizzle-orm';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }

  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const results = await db.select({
      course: courseSchema,
      teacher: {
        id: userSchema.id,
        fullName: userSchema.fullName,
        designation: userSchema.designation,
        profileImage: userSchema.profileImage,
      }
    })
    .from(courseSchema)
    .leftJoin(userSchema, eq(courseSchema.teacherId, userSchema.id))
    .where(and(
      eq(courseSchema.status, 'published'),
      eq(courseSchema.isFeatured, true),
      isNotNull(courseSchema.slug)
    ))
    .orderBy(desc(courseSchema.publishedAt), desc(courseSchema.updatedAt))
    .limit(1);

    const match = results[0];
    if (!match) {
      return NextResponse.json({ course: null }, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      });
    }

    const { course, teacher } = match;

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        price: formatPrice(course.price),
        priceValue: course.price,
        duration: course.duration,
        courseStartDate: course.courseStartDate,
        image: course.imageUrl,
        isFeatured: course.isFeatured,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder-square.svg',
        },
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}