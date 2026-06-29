import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { course as courseSchema, order as orderSchema } from '@/db/schema';
import { eq, sql, ne, count } from 'drizzle-orm';
import { BuilderCurriculumNode, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { videoLibraryNode } from '@/db/schema';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }
  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const [courses, orderCountsData] = await Promise.all([
      db.query.course.findMany({
        where: (c, { eq, isNotNull, and }) => and(
          eq(c.status, 'published'),
          isNotNull(c.slug)
        ),
        orderBy: (c, { desc }) => [desc(c.publishedAt), desc(c.updatedAt)],
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
        },
      }),
      db.select({
        courseId: orderSchema.courseId,
        count: sql<number>`count(${orderSchema.id})`.mapWith(Number),
      })
      .from(orderSchema)
      .where(eq(orderSchema.status, 'approved'))
      .groupBy(orderSchema.courseId)
    ]);

    const orderCountMap = new Map(orderCountsData.map(row => [row.courseId, row.count]));

    const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson));
    
    const countsData = await db.select({
      parentId: videoLibraryNode.parentId,
      count: count(videoLibraryNode.id)
    })
    .from(videoLibraryNode)
    .where(ne(videoLibraryNode.type, 'folder'))
    .groupBy(videoLibraryNode.parentId);
    
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

    return NextResponse.json({
      courses: processedCourses,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
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

