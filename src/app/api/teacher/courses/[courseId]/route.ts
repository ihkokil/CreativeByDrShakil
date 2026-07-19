import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
  slugify,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { parseDisplayDateToIso } from '@/lib/date-format';

const buildUniqueSlug = async (title: string, currentCourseId: string, supabase: any) => {
  const base = slugify(title) || `course-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {
    const { data } = await supabase.from('Course').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (!data || data.id === currentCourseId) {
      return slug;
    }

    slug = `${base}-${counter}`;
    counter += 1;
  }
};

const getCourseForPayload = async (courseId: string, userId: string, role: string, supabase: any) => {
  const { data: course } = await supabase.from('Course').select('*').eq('id', courseId).limit(1).maybeSingle();
  return course;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const supabase = getSupabaseAdmin();
    
    const { data: courseRow } = await supabase.from('Course').select('*').eq('id', courseId).limit(1).maybeSingle();

    if (!courseRow) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { data: instructors = [] } = await supabase.from('CourseInstructor').select('*').eq('courseId', courseId).order('sortOrder', { ascending: true });
    const course = { ...(courseRow as any), instructors };

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);
    const curriculum = await populateMediaVaultNodes(rawCurriculum);
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
    const supabase = getSupabaseAdmin();
    const existingCourse = await getCourseForPayload(courseId, payload.sub, payload.role, supabase);

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof body.title === 'string' && body.title.trim()) {
      const normalizedTitle = body.title.trim();
      updateData.title = normalizedTitle;
      updateData.slug = await buildUniqueSlug(normalizedTitle, existingCourse.id, supabase);
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
      const validModes = ['fixed_interval', 'groups_per_week', 'day_of_week', 'explicit_dates', 'instant', 'circular', null];
      if (!validModes.includes(body.releaseMode)) {
        return NextResponse.json({ error: 'Invalid release mode.' }, { status: 400 });
      }
      updateData.releaseMode = body.releaseMode === 'circular' ? null : body.releaseMode;
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

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase.from('Course').update(updateData as any).eq('id', existingCourse.id);
      if (updateError) throw updateError;
    }

    const { data: course } = await supabase.from('Course').select('*').eq('id', existingCourse.id).limit(1).maybeSingle();

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
    const supabase = getSupabaseAdmin();
    const existingCourse = await getCourseForPayload(courseId, payload.sub, payload.role, supabase);

    if (!existingCourse) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { data: orders = [] } = await supabase.from('Order').select('id').eq('courseId', existingCourse.id);
    const orderCount = orders ? orders.length : 0;
    
    if (existingCourse.status === 'published' || orderCount > 0) {
      return NextResponse.json(
        { error: 'Published courses or courses with orders cannot be deleted. Archive the course instead.' },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase.from('Course').delete().eq('id', existingCourse.id);
    if (deleteError) throw deleteError;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
