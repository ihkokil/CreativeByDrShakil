import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema, courseInstructor as courseInstructorSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';

interface InstructorData {
  id?: string;
  name: string;
  designation?: string;
  imageUrl?: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();

    const overview = typeof body.overview === 'string' ? body.overview.trim() : '';
    const learningOutcomes = typeof body.learningOutcomes === 'string' ? body.learningOutcomes.trim() : '';
    const instructors = Array.isArray(body.instructors) ? body.instructors : [];

    // Verify course exists and belongs to teacher
    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      columns: { teacherId: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Delete existing instructors
    await db.delete(courseInstructorSchema).where(eq(courseInstructorSchema.courseId, courseId));

    // Create new instructors
    const validInstructors = instructors.filter(
      (instr: InstructorData) => typeof instr.name === 'string' && instr.name.trim()
    );

    await Promise.all(
      validInstructors.map((instr: InstructorData, index: number) =>
        db.insert(courseInstructorSchema).values({
          id: crypto.randomUUID(),
          courseId,
          name: instr.name.trim(),
          designation: instr.designation ? instr.designation.trim() : null,
          imageUrl: instr.imageUrl || null,
          sortOrder: index,
        })
      )
    );

    // Update course
    await db.update(courseSchema).set({
        overview,
        learningOutcomes,
      }).where(eq(courseSchema.id, courseId));

    const updatedCourse = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      with: { instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
    });

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
