import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  slugify,
} from '@/lib/teacher-course-builder';

const buildUniqueSlug = async (title: string, currentCourseId: string) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {
    const found = await prisma.course.findUnique({ where: { slug }, select: { id: true } });
    if (!found || found.id === currentCourseId) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }
};

const getCourseForPayload = async (courseId: string, userId: string, role: string) => {
  if (role === 'admin') {
    return prisma.course.findUnique({ where: { id: courseId } });
  }

  return prisma.course.findFirst({ where: { id: courseId, teacherId: userId } });
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const course = await getCourseForPayload(courseId, payload.sub, payload.role);

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const curriculum = parseCurriculumJson(course.curriculumJson);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);
    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: course.releaseMode,
      releaseStartAt: course.releaseStartAt,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
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
    if (typeof body.category === 'string') updateData.category = body.category.trim() || null;
    if (typeof body.duration === 'string') updateData.duration = body.duration.trim() || existingCourse.duration;
    if (typeof body.language === 'string') updateData.language = body.language.trim() || null;
    if (typeof body.level === 'string') updateData.level = body.level.trim() || null;
    if (typeof body.imageUrl === 'string') updateData.imageUrl = body.imageUrl.trim() || null;
    if (typeof body.timezone === 'string' && body.timezone.trim()) updateData.timezone = body.timezone.trim();

    if (body.price !== undefined) {
      const numericPrice = Number(body.price);
      if (Number.isNaN(numericPrice) || numericPrice < 0) {
        return NextResponse.json({ error: 'Price must be a valid positive number.' }, { status: 400 });
      }
      updateData.price = numericPrice;
    }

    if (body.releaseMode !== undefined) {
      const validModes = ['fixed_interval', 'groups_per_week', 'explicit_dates', null];
      if (!validModes.includes(body.releaseMode)) {
        return NextResponse.json({ error: 'Invalid release mode.' }, { status: 400 });
      }
      updateData.releaseMode = body.releaseMode;
    }

    if (body.releaseStartAt !== undefined) {
      updateData.releaseStartAt = body.releaseStartAt ? new Date(body.releaseStartAt) : null;
    }

    if (body.releaseIntervalDays !== undefined) {
      const parsed = Number(body.releaseIntervalDays);
      updateData.releaseIntervalDays = Number.isNaN(parsed) ? null : Math.max(1, Math.floor(parsed));
    }

    if (body.releaseGroupsPerWeek !== undefined) {
      const parsed = Number(body.releaseGroupsPerWeek);
      updateData.releaseGroupsPerWeek = parsed === 3 ? 3 : parsed === 2 ? 2 : null;
    }

    if (body.releaseGroupDates !== undefined) {
      updateData.releaseGroupDates = parseReleaseGroupDateMap(body.releaseGroupDates);
    }

    if (body.status !== undefined) {
      const validStatus = ['draft', 'scheduled', 'published', 'archived'];
      if (!validStatus.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid course status.' }, { status: 400 });
      }

      updateData.status = body.status;
      updateData.publishedAt = body.status === 'published' ? new Date() : null;
    }

    const course = await prisma.course.update({
      where: { id: existingCourse.id },
      data: updateData,
    });

    return NextResponse.json({ course });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
