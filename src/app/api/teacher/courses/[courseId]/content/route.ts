import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const validInstructors = instructors.filter(
      (instr: InstructorData) => typeof instr.name === 'string' && instr.name.trim()
    );

    // Update course and instructors transactionally
    const updatedCourse = await db.$transaction(async (tx) => {
      // Delete existing instructors
      await tx.courseInstructor.deleteMany({
        where: { courseId: courseId }
      });

      // Create new instructors
      if (validInstructors.length > 0) {
        await tx.courseInstructor.createMany({
          data: validInstructors.map((instr: InstructorData, index: number) => ({
            id: crypto.randomUUID(),
            courseId,
            name: instr.name.trim(),
            designation: instr.designation ? instr.designation.trim() : null,
            imageUrl: instr.imageUrl || null,
            sortOrder: index,
          }))
        });
      }

      // Update course details
      await tx.course.update({
        where: { id: courseId },
        data: {
          overview,
          learningOutcomes,
        }
      });

      // Return updated course
      return tx.course.findUnique({
        where: { id: courseId },
        include: {
          instructors: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });

    return NextResponse.json({ course: updatedCourse }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
