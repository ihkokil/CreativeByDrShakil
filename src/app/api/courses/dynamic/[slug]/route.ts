import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import prisma from '@/lib/prisma';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';

const formatPrice = (price: number) => {
  if (price <= 0) return 'Free';
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const course = await prisma.course.findUnique({
      where: { slug: slug },
      include: {
        teacher: {
          select: {
            id: true,
            fullName: true,
            designation: true,
            profileImage: true,
          },
        },
        instructors: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            designation: true,
            sortOrder: true,
          },
        },
        category: {
          select: {
            displayName: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const curriculum = parseCurriculumJson(course.curriculumJson);

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        category: course.category?.displayName || 'General',
        price: formatPrice(course.price),
        salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
        priceValue: course.price,
        duration: course.duration,
        isFeatured: course.isFeatured,
        description: course.overview || course.description,
        overview: course.overview,
        learningOutcomes: course.learningOutcomes,
        language: course.language || 'English / Bengali',
        level: course.level || 'Intermediate',
        image: course.imageUrl || '/placeholder.svg',
        status: course.status,
        lastUpdated: course.updatedAt.toISOString(),
        publishedAt: course.publishedAt,
        instructors: course.instructors,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder.svg',
        },
      },
      curriculum: curriculum,
    });
  } catch (error: any) {
    console.error('[Course Dynamic Slug Error]', {
      message: error?.message,
      slug: params.slug,
    });
    return NextResponse.json(
      { error: 'Failed to load course details.' },
      { status: 500 }
    );
  }
}
