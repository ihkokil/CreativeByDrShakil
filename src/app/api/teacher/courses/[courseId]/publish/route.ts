import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const status = body.status || 'published';

    // Verify course exists and belongs to teacher
    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      columns: { teacherId: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Validate course has required fields
    const fullCourse = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      with: { instructors: true },
    });

    if (!fullCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const missingFields = [];
    if (!fullCourse.title) missingFields.push('title');
    if (fullCourse.price === undefined || fullCourse.price === null) missingFields.push('price');
    if (!fullCourse.duration) missingFields.push('duration');
    // imageUrl is now optional
    if (!fullCourse.overview) missingFields.push('overview');
    if (fullCourse.instructors.length === 0) missingFields.push('instructors');

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot publish course. Missing fields: ${missingFields.join(', ')}`,
          missingFields,
        },
        { status: 400 }
      );
    }

    // Update course status
    await db.update(courseSchema)
      .set({
        status,
        publishedAt: status === 'published' ? new Date().toISOString() : null,
      })
      .where(eq(courseSchema.id, courseId));

    const publishedCourse = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      with: { instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] } },
    });

    return NextResponse.json({ course: publishedCourse }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
