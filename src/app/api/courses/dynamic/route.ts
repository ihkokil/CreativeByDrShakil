import { NextResponse, NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { countLessons, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { getCachedOrFetch } from '@/lib/kv-cache';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

// FREE TIER OPTIMIZATION: Cache with TTL and pagination to stay within 50ms CPU budget
export async function GET(request: NextRequest) {
  try {
    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(20, parseInt(searchParams.get('limit') || '20')); // Max 20 per page
    const offset = (page - 1) * limit;

    // Use cache with pagination key to avoid re-computing expensive data
    const cacheKey = `courses:dynamic:page:${page}:limit:${limit}`;

    return NextResponse.json(
      await getCachedOrFetch(
        { key: cacheKey, ttl: 600 }, // Cache for 10 minutes
        async () => {
          // This code only runs on cache miss (first request or after TTL)
          const courses = await db.query.course.findMany({
            where: (c, { eq, isNotNull, and }) => and(
              eq(c.status, 'published'),
              isNotNull(c.slug)
            ),
            orderBy: (c, { desc }) => [desc(c.publishedAt), desc(c.updatedAt)],
            limit: limit,        // FREE TIER: Limit to max 20 courses per page
            offset: offset,      // FREE TIER: Paginate results
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

          const processedCourses = await Promise.all(courses.map(async (course) => {
            const rawCurriculum = parseCurriculumJson(course.curriculumJson);
            const curriculum = await populateMediaVaultNodes(rawCurriculum);
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
          }));

          return {
            courses: processedCourses,
            pagination: {
              page,
              limit,
              offset,
            },
          };
        }
      )
    );
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

