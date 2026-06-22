import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';
import { formatLastUpdated } from '@/lib/date-format';

const formatPrice = (price: number) => {
  if (price <= 0) return 'Free';
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {

    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.slug, slug),
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

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const curriculum = parseCurriculumJson(course.curriculumJson);

    return NextResponse.json({
      course: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        price: formatPrice(course.price),
        salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
        priceValue: course.price,
        duration: course.duration,
        isFeatured: course.isFeatured,
        description: course.overview || course.description,
        overview: course.overview,
        learningOutcomes: course.learningOutcomes,
        language: course.language || 'English / Bengali',
        image: course.imageUrl || '/placeholder.svg',
        status: course.status,
        lastUpdated: formatLastUpdated(course.updatedAt),
        enrolledCount: course.orders.length,
        publishedAt: course.publishedAt,
        instructors: course.instructors,
        mainInstructor: {
          id: course.teacher?.id || `teacher-${course.id}`,
          name: course.teacher?.fullName || course.instructor,
          role: course.teacher?.designation || 'Course Instructor',
          image: course.teacher?.profileImage || '/placeholder-square.svg',
        },
      },
      curriculum: curriculum,
    });
  } catch (error: any) {
    console.error('[Course Dynamic Slug Error]', {
      message: error?.message,
      slug: slug,
    });
    return NextResponse.json(
      { error: 'Failed to load course details.' },
      { status: 500 }
    );
  }
}
