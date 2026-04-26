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
    const course = await prisma.course.findFirst({
      where: {
        status: 'published',
        isFeatured: true,
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

    if (!course) {
      return NextResponse.json({ course: null });
    }

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
          image: course.teacher?.profileImage || '/placeholder.svg',
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}