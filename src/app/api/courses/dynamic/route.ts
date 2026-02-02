import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      where: {
        status: 'published',
        slug: { not: null },
      },
      orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            profileImage: true,
          },
        },
      },
    });

    return NextResponse.json({
      courses: courses.map((course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        category: course.category || 'General',
        price: formatPrice(course.price),
        priceValue: course.price,
        duration: course.duration,
        rating: 4.9,
        description: course.description,
        language: course.language || 'English / Bengali',
        level: course.level || 'All Levels',
        image: course.imageUrl,
        status: course.status,
        publishedAt: course.publishedAt,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder.svg',
        },
      })),
    });
  } catch (error: any) {
    console.error('[Courses Dynamic Error]', error?.message || error);
    return NextResponse.json({ error: 'Failed to load courses.' }, { status: 500 });
  }
}
