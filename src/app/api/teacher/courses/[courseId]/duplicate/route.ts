import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { slugify } from '@/lib/teacher-course-builder';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: original, error: fetchError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('*')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!original) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const newId = nanoid();
    const nowStr = new Date().toISOString();
    const newTitle = `${original.title} (Copy)`;
    const newSlug = `${slugify(newTitle)}-${Date.now().toString(36)}`;

    // Clone the course (draft status, no publishedAt)
    const { error: insertError } = await supabase.from('Course')
// @ts-ignore
.insert({
      id: newId,
      title: newTitle,
      slug: newSlug,
      description: original.description,
      overview: original.overview,
      learningOutcomes: original.learningOutcomes,
      duration: original.duration,
      language: original.language,
      imageUrl: original.imageUrl,
      price: original.price,
      salePrice: original.salePrice,
      status: 'draft',
      teacherId: payload.sub,
      instructor: original.instructor,
      timezone: original.timezone,
      releaseMode: original.releaseMode,
      releaseStartAt: null,
      releaseIntervalDays: original.releaseIntervalDays,
      releaseGroupsPerWeek: original.releaseGroupsPerWeek,
      releaseDaysOfWeek: original.releaseDaysOfWeek,
      releaseGroupDates: original.releaseGroupDates,
      curriculumJson: original.curriculumJson,
      courseStartDate: null,
      publishedAt: null,
      createdAt: nowStr,
      updatedAt: nowStr,
    } as any);

    if (insertError) throw insertError;

    // Duplicate course instructors
    const { data: instructors = [] } = await supabase
      .from('CourseInstructor')
      .select('*')
      .eq('courseId', courseId);

    if (instructors && instructors.length > 0) {
      for (const inst of instructors as any[]) {
        const { error: instError } = await supabase.from('CourseInstructor')
// @ts-ignore
.insert({
          id: nanoid(),
          courseId: newId,
          name: inst.name,
          designation: inst.designation,
          imageUrl: inst.imageUrl,
          sortOrder: inst.sortOrder,
          createdAt: nowStr,
        } as any);
        if (instError) throw instError;
      }
    }

    return NextResponse.json({
      success: true,
      courseId: newId,
      slug: newSlug,
      message: `Course duplicated as "${newTitle}".`,
    });
  } catch (error: any) {
    console.error('[teacher/courses/duplicate] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
