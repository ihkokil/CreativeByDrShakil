import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
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

    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.slug, slug),
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const [teacher, instructors, orders] = await Promise.all([
      course.teacherId
        ? db.query.users.findFirst({
            where: eq(schema.users.id, course.teacherId),
            columns: {
              id: true,
              fullName: true,
              designation: true,
              profileImage: true,
            },
          })
        : Promise.resolve(null),
      db.query.courseInstructors.findMany({
        where: eq(schema.courseInstructors.courseId, course.id),
        orderBy: [asc(schema.courseInstructors.sortOrder)],
        columns: {
          id: true,
          name: true,
          designation: true,
          imageUrl: true,
          sortOrder: true,
        },
      }),
      db.query.orders.findMany({
        where: and(
          eq(schema.orders.courseId, course.id),
          eq(schema.orders.status, 'approved')
        ),
        columns: {
          id: true,
        },
      }),
    ]);

    const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
    const curriculum = await populateMediaVaultNodes(rawCurriculum);

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
        enrolledCount: orders.length,
        publishedAt: course.publishedAt,
        instructors: instructors,
        mainInstructor: {
          id: teacher?.id || `teacher-${course.id}`,
          name: teacher?.fullName || course.instructor,
          role: teacher?.designation || 'Course Instructor',
          image: teacher?.profileImage || '/placeholder-square.svg',
        },
      },
      curriculum: curriculum,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
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
