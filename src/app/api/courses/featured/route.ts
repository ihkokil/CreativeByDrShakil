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
      id: courseSchema.id,
      slug: courseSchema.slug,
      title: courseSchema.title,
      price: courseSchema.price,
      duration: courseSchema.duration,
      courseStartDate: courseSchema.courseStartDate,
      imageUrl: courseSchema.imageUrl,
      isFeatured: courseSchema.isFeatured,
      instructor: courseSchema.instructor,
      teacherId: userSchema.id,
      teacherFullName: userSchema.fullName,
      teacherDesignation: userSchema.designation,
      teacherProfileImage: userSchema.profileImage,
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

    return NextResponse.json({
      course: {
        id: match.id,
        slug: match.slug,
        title: match.title,
        price: formatPrice(match.price),
        priceValue: match.price,
        duration: match.duration,
        courseStartDate: match.courseStartDate,
        image: match.imageUrl,
        isFeatured: match.isFeatured,
        mainInstructor: {
          id: match.teacherId || `teacher-${match.id}`,
          name: match.teacherFullName || match.instructor,
          role: match.teacherDesignation || 'Course Instructor',
          image: match.teacherProfileImage || '/placeholder-square.svg',
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