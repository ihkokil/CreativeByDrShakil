import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { requireTeacherPayload } from '@/lib/route-auth';
import { slugify } from '@/lib/teacher-course-builder';

const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (await db.query.courses.findFirst({ where: eq(schema.courses.slug, slug) })) {
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
    const originalCourse = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
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
    await db.insert(schema.courses).values({
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
      courseStartDate: originalCourse.courseStartDate,
      learningOutcomes: originalCourse.learningOutcomes,
      teacherId: originalCourse.teacherId,
      status: 'draft', // Always duplicate as draft
      timezone: originalCourse.timezone,
      releaseMode: originalCourse.releaseMode,
      releaseStartAt: originalCourse.releaseStartAt,
      releaseIntervalDays: originalCourse.releaseIntervalDays,
      releaseGroupsPerWeek: originalCourse.releaseGroupsPerWeek,
      releaseGroupDates: originalCourse.releaseGroupDates as string,
      curriculumJson: originalCourse.curriculumJson as string,
      releaseDaysOfWeek: typeof originalCourse.releaseDaysOfWeek === 'object' && originalCourse.releaseDaysOfWeek ? JSON.stringify(originalCourse.releaseDaysOfWeek) : (originalCourse.releaseDaysOfWeek as string),
      isFeatured: false, // Reset featured status
    });

    if (originalCourse.instructors && originalCourse.instructors.length > 0) {
      await db.insert(schema.courseInstructors).values(
        originalCourse.instructors.map(inst => ({
          id: crypto.randomUUID(),
          courseId: newCourseId,
          name: inst.name,
          designation: inst.designation,
          sortOrder: inst.sortOrder,
          imageUrl: inst.imageUrl,
        }))
      );
    }
    
    const finalCourse = await db.query.courses.findFirst({
      where: eq(schema.courses.id, newCourseId),
      with: { instructors: { orderBy: [asc(schema.courseInstructors.sortOrder)] } },
    });

    return NextResponse.json({ course: finalCourse });
  } catch (error: any) {
    console.error('Course duplication error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
