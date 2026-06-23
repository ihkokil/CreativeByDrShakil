import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  slugify,
} from '@/lib/teacher-course-builder';
import { parseDisplayDateToIso } from '@/lib/date-format';


const buildUniqueSlug = async (title: string, currentCourseId: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {

    const found = await db.query.course.findFirst({ where: (c, { eq }) => eq(c.slug, slug), columns: { id: true } });
    if (!found || found.id === currentCourseId) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }
};

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  return db.query.course.findFirst({ where: (c, { eq }) => eq(c.id, courseId) });
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
      with: {
        instructors: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Teachers and Admins can see/manage all courses

    const curriculum = parseCurriculumJson(course.curriculumJson);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt || course.courseStartDate,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek: (course as any).releaseDaysOfWeek as number[],
      releaseGroupDates,
    });

    return NextResponse.json({
      course,
      curriculum,
      groups,
      releaseGroupDates,
      computedReleaseGroupDates,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const existingCourse = await getCourseForPayload(courseId, payload.sub, payload.role);

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      const normalizedTitle = body.title.trim();
      updateData.title = normalizedTitle;
      updateData.slug = await buildUniqueSlug(normalizedTitle, existingCourse.id);
    }

    if (typeof body.description === 'string') updateData.description = body.description.trim() || existingCourse.description;
    if (typeof body.overview === 'string') updateData.overview = body.overview.trim() || null;
    if (typeof body.learningOutcomes === 'string') updateData.learningOutcomes = body.learningOutcomes.trim() || null;

    if (typeof body.duration === 'string') updateData.duration = body.duration.trim() || existingCourse.duration;
    if (typeof body.language === 'string') updateData.language = body.language.trim() || null;
    if (typeof body.imageUrl === 'string') updateData.imageUrl = body.imageUrl.trim() || null;
    if (typeof body.timezone === 'string' && body.timezone.trim()) updateData.timezone = body.timezone.trim();
    if (body.isFeatured !== undefined) updateData.isFeatured = Boolean(body.isFeatured);
    if (body.courseStartDate !== undefined) {
      const courseStartDate = typeof body.courseStartDate === 'string' ? parseDisplayDateToIso(body.courseStartDate) : null;
      updateData.courseStartDate = courseStartDate ? new Date(courseStartDate) : null;
    }

    if (body.price !== undefined) {
      const numericPrice = Number(body.price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
      }
      updateData.price = numericPrice;
    }

    if (body.releaseMode !== undefined) {
      const validModes = ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant', null];
      if (!validModes.includes(body.releaseMode)) {
        return NextResponse.json({ error: 'Invalid release mode.' }, { status: 400 });
      }
      updateData.releaseMode = body.releaseMode;
    }

    if (body.releaseStartAt !== undefined) {
      const releaseStartAt = typeof body.releaseStartAt === 'string' ? parseDisplayDateToIso(body.releaseStartAt) : null;
      updateData.releaseStartAt = releaseStartAt ? new Date(releaseStartAt) : null;
    }

    if (body.releaseIntervalDays !== undefined) {
      const parsed = Number(body.releaseIntervalDays);
      updateData.releaseIntervalDays = Number.isNaN(parsed) ? null : Math.max(1, Math.floor(parsed));
    }

    if (body.releaseGroupsPerWeek !== undefined) {
      const parsed = Number(body.releaseGroupsPerWeek);
      updateData.releaseGroupsPerWeek = parsed === 3 ? 3 : parsed === 2 ? 2 : null;
    }

    if (body.releaseDaysOfWeek !== undefined) {
      if (body.releaseDaysOfWeek !== null && (!Array.isArray(body.releaseDaysOfWeek) || body.releaseDaysOfWeek.some((d: any) => typeof d !== 'number' || d < 0 || d > 6))) {
        return NextResponse.json({ error: 'releaseDaysOfWeek must be an array of numbers (0-6).' }, { status: 400 });
      }
      updateData.releaseDaysOfWeek = body.releaseDaysOfWeek ? JSON.stringify(body.releaseDaysOfWeek) : null;
    }

    if (body.releaseGroupDates !== undefined) {
      updateData.releaseGroupDates = body.releaseGroupDates ? JSON.stringify(parseReleaseGroupDateMap(body.releaseGroupDates)) : null;
    }

    if (body.status !== undefined) {
      const validStatus = ['draft', 'scheduled', 'published', 'archived'];
      if (!validStatus.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid course status.' }, { status: 400 });
      }

      updateData.status = body.status;
      updateData.publishedAt = body.status === 'published' ? new Date() : null;
    }

    if (updateData.courseStartDate instanceof Date) {
      updateData.courseStartDate = updateData.courseStartDate.toISOString();
    }
    if (updateData.publishedAt instanceof Date) {
      updateData.publishedAt = updateData.publishedAt.toISOString();
    }
    if (updateData.releaseStartAt instanceof Date) {
      updateData.releaseStartAt = updateData.releaseStartAt.toISOString();
    }
    // price is already a number for doublePrecision column

    const [course] = await db.update(courseSchema)
      .set(updateData)
      .where(eq(courseSchema.id, existingCourse.id))
      .returning();

    return NextResponse.json({ course });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const existingCourse = await getCourseForPayload(courseId, payload.sub, payload.role);

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Published courses or courses with orders cannot be deleted
    const orders = await db.query.order.findMany({ where: (o, { eq }) => eq(o.courseId, existingCourse.id), columns: { id: true } });
    const orderCount = orders.length;
    if (existingCourse.status === 'published' || orderCount > 0) {
      return NextResponse.json(
        { error: 'Published courses or courses with orders cannot be deleted. Archive the course instead.' },
        { status: 400 }
      );
    }

    await db.delete(courseSchema).where(eq(courseSchema.id, existingCourse.id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
