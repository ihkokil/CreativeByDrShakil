import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireTeacherPayload } from '@/lib/route-auth';
import { slugify } from '@/lib/teacher-course-builder';

const buildUniqueSlug = async (title: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (await prisma.course.findUnique({ where: { slug } })) {
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
    const originalCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructors: true,
      },
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
    const duplicatedCourse = await prisma.course.create({
      data: {
        title: newTitle,
        slug: newSlug,
        description: originalCourse.description,
        overview: originalCourse.overview,
        price: originalCourse.price,
        salePrice: originalCourse.salePrice,
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
        releaseGroupDates: originalCourse.releaseGroupDates,
        curriculumJson: originalCourse.curriculumJson,
        releaseDaysOfWeek: originalCourse.releaseDaysOfWeek,
        isFeatured: false, // Reset featured status
        instructors: {
          create: originalCourse.instructors.map((inst) => ({
            name: inst.name,
            designation: inst.designation,
            sortOrder: inst.sortOrder,
            imageUrl: inst.imageUrl,
          })),
        },
      },
      include: {
        instructors: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ course: duplicatedCourse });
  } catch (error: any) {
    console.error('Course duplication error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
