import { NextResponse, NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { BuilderCurriculumNode, parseCurriculumJson } from '@/lib/teacher-course-builder';
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
          const [courses, orderCountsData] = await Promise.all([
            db.course.findMany({
              where: {
                status: 'published',
                slug: { not: null }
              },
              orderBy: [
                { publishedAt: 'desc' },
                { updatedAt: 'desc' }
              ],
              take: limit,
              skip: offset,
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
                    imageUrl: true,
                    sortOrder: true,
                  },
                },
              },
            }),
            db.order.groupBy({
              by: ['courseId'],
              where: { status: 'approved' },
              _count: { id: true }
            })
          ]);

          const orderCountMap = new Map(orderCountsData.map(row => [row.courseId, row._count.id]));

          const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson as string));
          
          const countsData = await db.videoLibraryNode.groupBy({
            by: ['parentId'],
            where: {
              type: { not: 'folder' },
              parentId: { not: null }
            },
            _count: { id: true }
          });
          
          let folderCounts: Record<string, number> = {};
          for (const row of countsData) {
            if (row.parentId) folderCounts[row.parentId] = row._count.id;
          }

          const processedCourses = courses.map((course, index) => {
            const curriculum = rawCurriculums[index];
            let lessonCount = 0;
            
            const countNodes = (list: BuilderCurriculumNode[]) => {
              list.forEach(node => {
                if (node.type !== 'folder') {
                  lessonCount++;
                }
                if (node.mediaVaultFolderId) {
                   if (folderCounts[node.mediaVaultFolderId]) {
                       lessonCount += folderCounts[node.mediaVaultFolderId];
                   }
                } else if (node.children) {
                  countNodes(node.children);
                }
              });
            };
            countNodes(curriculum);

            const enrolledCount = orderCountMap.get(course.id) || 0;

            return {
              id: course.id,
              slug: course.slug,
              title: course.title,
              price: formatPrice(course.price),
              salePrice: course.salePrice ? formatPrice(course.salePrice) : null,
              priceValue: course.price,
              duration: course.duration,
              lessonCount,
              enrolledCount,
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
          });

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
