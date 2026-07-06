import { NextResponse, NextRequest } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, and, ne, isNotNull, desc, asc, sql, inArray } from 'drizzle-orm';
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
            db.query.courses.findMany({
              where: and(
                eq(schema.courses.status, 'published'),
                isNotNull(schema.courses.slug)
              ),
              orderBy: [
                desc(schema.courses.publishedAt),
                desc(schema.courses.updatedAt)
              ],
              limit: limit,
              offset: offset,
            }),
            db.select({
              courseId: schema.orders.courseId,
              count: sql<number>`count(${schema.orders.id})`.mapWith(Number)
            })
            .from(schema.orders)
            .where(eq(schema.orders.status, 'approved'))
            .groupBy(schema.orders.courseId)
          ]);

          const courseIds = courses.map(c => c.id);
          const teacherIds = [...new Set(courses.map(c => c.teacherId).filter(Boolean))] as string[];

          const [teachers, allInstructors] = await Promise.all([
            teacherIds.length > 0
              ? db.query.users.findMany({
                  where: inArray(schema.users.id, teacherIds),
                  columns: {
                    id: true,
                    fullName: true,
                    designation: true,
                    profileImage: true,
                  }
                })
              : Promise.resolve([]),
            courseIds.length > 0
              ? db.query.courseInstructors.findMany({
                  where: inArray(schema.courseInstructors.courseId, courseIds),
                  orderBy: [asc(schema.courseInstructors.sortOrder)],
                  columns: {
                    id: true,
                    courseId: true,
                    name: true,
                    designation: true,
                    imageUrl: true,
                    sortOrder: true,
                  }
                })
              : Promise.resolve([]),
          ]);

          const teacherMap = new Map(teachers.map(t => [t.id, t]));
          const instructorsMap = new Map<string, typeof allInstructors>();
          for (const inst of allInstructors) {
            const list = instructorsMap.get(inst.courseId) || [];
            list.push(inst);
            instructorsMap.set(inst.courseId, list);
          }

          const orderCountMap = new Map(orderCountsData.map(row => [row.courseId, row.count]));

          const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson as string));
          
          const countsData = await db.select({
            parentId: schema.videoLibraryNodes.parentId,
            count: sql<number>`count(${schema.videoLibraryNodes.id})`.mapWith(Number)
          })
          .from(schema.videoLibraryNodes)
          .where(and(
            ne(schema.videoLibraryNodes.type, 'folder'),
            isNotNull(schema.videoLibraryNodes.parentId)
          ))
          .groupBy(schema.videoLibraryNodes.parentId);
          
          let folderCounts: Record<string, number> = {};
          for (const row of countsData) {
            if (row.parentId) folderCounts[row.parentId] = row.count;
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
             const teacher = course.teacherId ? teacherMap.get(course.teacherId) : null;
             const instructors = instructorsMap.get(course.id) || [];

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
               instructors,
               mainInstructor: {
                 id: teacher?.id || `teacher-${course.id}`,
                 name: teacher?.fullName || course.instructor,
                 role: teacher?.designation || 'Course Instructor',
                 image: teacher?.profileImage || '/placeholder-square.svg',
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
      { 
        error: 'Failed to load courses. Please try again.',
        debug_message: error?.message,
        debug_stack: error?.stack
      },
      { status: 500 }
    );
  }
}
