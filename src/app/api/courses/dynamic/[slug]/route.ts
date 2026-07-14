import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { formatLastUpdated } from '@/lib/date-format';
import { course as courseSchema, user as userSchema, courseInstructor as courseInstructorSchema, order as orderSchema } from '@/db/schema';
import { eq, and, asc, count } from 'drizzle-orm';

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

    const [course] = await db.select().from(courseSchema).where(eq(courseSchema.slug, slug)).limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const [teacher, instructors, enrolledResult] = await Promise.all([
      course.teacherId
        ? db.select({ id: userSchema.id, fullName: userSchema.fullName, designation: userSchema.designation, profileImage: userSchema.profileImage }).from(userSchema).where(eq(userSchema.id, course.teacherId)).limit(1).then(r => r[0] || null)
        : Promise.resolve(null),
      db.select().from(courseInstructorSchema).where(eq(courseInstructorSchema.courseId, course.id)).orderBy(asc(courseInstructorSchema.sortOrder)),
      db.select({ count: count() }).from(orderSchema).where(and(eq(orderSchema.courseId, course.id), eq(orderSchema.status, 'approved'))).then(r => r[0]?.count || 0),
    ]);

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
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
        enrolledCount: enrolledResult,
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
