import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCachedOrFetch } from '@/lib/kv-cache';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }

  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

// FREE TIER OPTIMIZATION: Cache featured course to stay within 50ms CPU budget
export async function GET() {
  try {
    const cacheKey = 'course:featured';

    return NextResponse.json(
      await getCachedOrFetch(
        { key: cacheKey, ttl: 3600 }, // Cache for 1 hour (featured rarely changes)
        async () => {
          const course = await db.course.findFirst({
            where: {
              status: 'published',
              isFeatured: true,
              slug: { not: null }
            },
            orderBy: [
              { publishedAt: 'desc' },
              { updatedAt: 'desc' }
            ],
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
            return { course: null };
          }

          return {
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
          };
        }
      ),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}