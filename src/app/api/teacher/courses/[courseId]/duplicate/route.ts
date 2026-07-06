import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema, courseInstructor as courseInstructorSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import { slugify } from '@/lib/teacher-course-builder';

const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (await db.query.course.findFirst({ where: (c, { eq }) => eq(c.slug, slug) })) {
    slug = `${base}-${counter}`;
    counter += 1;
  }

  return slug;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    
    // Find the original course
    const originalCourse = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      with: { instructors: true },
    });

    if (!originalCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Authorization check
    if (payload.role !== 'admin' && originalCourse.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const newTitle = `${originalCourse.title} (Copy)`;
    const newSlug = await buildUniqueSlug(newTitle);

    // Create the duplicated course
    const newCourseId = crypto.randomUUID();
    const [duplicatedCourse] = await db.insert(courseSchema).values({
      id: newCourseId,
      title: newTitle,
      slug: newSlug,
      description: originalCourse.description,
      overview: originalCourse.overview,
      price: originalCourse.price ?? 0,
      salePrice: originalCourse.salePrice ?? null,
      instructor: originalCourse.instructor,
      language: originalCourse.language,
      imageUrl: originalCourse.imageUrl,
      duration: originalCourse.duration,
      courseStartDate: originalCourse.courseStartDate ? new Date(originalCourse.courseStartDate).toISOString() : null,
      learningOutcomes: originalCourse.learningOutcomes,
      teacherId: originalCourse.teacherId,
      status: 'draft', // Always duplicate as draft
      timezone: originalCourse.timezone,
      releaseMode: originalCourse.releaseMode,
      releaseStartAt: originalCourse.releaseStartAt ? new Date(originalCourse.releaseStartAt).toISOString() : null,
      releaseIntervalDays: originalCourse.releaseIntervalDays,
      releaseGroupsPerWeek: originalCourse.releaseGroupsPerWeek,
      releaseGroupDates: originalCourse.releaseGroupDates as any,
      curriculumJson: originalCourse.curriculumJson as any,
      releaseDaysOfWeek: typeof originalCourse.releaseDaysOfWeek === 'object' && originalCourse.releaseDaysOfWeek ? JSON.stringify(originalCourse.releaseDaysOfWeek) : (originalCourse.releaseDaysOfWeek as any),
      isFeatured: false, // Reset featured status
    }).returning();

    if (originalCourse.instructors && originalCourse.instructors.length > 0) {
      await Promise.all(originalCourse.instructors.map(inst =>
        db.insert(courseInstructorSchema).values({
          id: crypto.randomUUID(),
          courseId: newCourseId,
          name: inst.name,
          designation: inst.designation,
          sortOrder: inst.sortOrder,
          imageUrl: inst.imageUrl,
        })
      ));
    }
    
    const finalCourse = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, newCourseId),
      with: { instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
    });

    return NextResponse.json({ course: finalCourse });
  } catch (error: any) {
    console.error('Course duplication error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
