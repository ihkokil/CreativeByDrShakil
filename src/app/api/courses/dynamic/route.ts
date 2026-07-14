import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { course as courseSchema, order as orderSchema, user as userSchema, courseInstructor as courseInstructorSchema } from '@/db/schema';
import { eq, sql, ne, count, and, isNotNull, inArray, desc, asc } from 'drizzle-orm';
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
    const [coursesData, orderCountsData] = await Promise.all([
      db.select()
        .from(courseSchema)
        .where(and(
          eq(courseSchema.status, 'published'),
          isNotNull(courseSchema.slug)
        ))
        .orderBy(desc(courseSchema.publishedAt), desc(courseSchema.updatedAt)),
      db.select({
        courseId: orderSchema.courseId,
        count: sql<number>`count(${orderSchema.id})`.mapWith(Number),
      })
      .from(orderSchema)
      .where(eq(orderSchema.status, 'approved'))
      .groupBy(orderSchema.courseId)
    ]);

    const teacherIds = Array.from(new Set(coursesData.map(c => c.teacherId).filter(Boolean))) as string[];
    const courseIds = coursesData.map(c => c.id);

    const [teachers, instructors] = await Promise.all([
      teacherIds.length > 0
        ? db.select({
            id: userSchema.id,
            fullName: userSchema.fullName,
            designation: userSchema.designation,
            profileImage: userSchema.profileImage,
          })
          .from(userSchema)
          .where(inArray(userSchema.id, teacherIds))
        : Promise.resolve([]),
      courseIds.length > 0
        ? db.select({
            id: courseInstructorSchema.id,
            courseId: courseInstructorSchema.courseId,
            name: courseInstructorSchema.name,
            designation: courseInstructorSchema.designation,
            imageUrl: courseInstructorSchema.imageUrl,
            sortOrder: courseInstructorSchema.sortOrder,
          })
          .from(courseInstructorSchema)
          .where(inArray(courseInstructorSchema.courseId, courseIds))
          .orderBy(asc(courseInstructorSchema.sortOrder))
        : Promise.resolve([]),
    ]);

    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const instructorsMap = new Map<string, any[]>();
    instructors.forEach(inst => {
      const list = instructorsMap.get(inst.courseId) || [];
      list.push(inst);
      instructorsMap.set(inst.courseId, list);
    });

    const courses = coursesData.map(c => ({
      ...c,
      teacher: c.teacherId ? teacherMap.get(c.teacherId) || null : null,
      instructors: instructorsMap.get(c.id) || [],
    }));

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

