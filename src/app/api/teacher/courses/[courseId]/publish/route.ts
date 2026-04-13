import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true, title: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Validate course has required fields
    const fullCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructors: true },
    });

    if (!fullCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const missingFields = [];
    if (!fullCourse.title) missingFields.push('title');
    if (!fullCourse.categoryId) missingFields.push('category');
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
    const publishedCourse = await prisma.course.update({
      where: { id: courseId },
      data: {
        status,
        publishedAt: status === 'published' ? new Date() : null,
      },
      include: {
        instructors: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    });

    return NextResponse.json({ course: publishedCourse }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
