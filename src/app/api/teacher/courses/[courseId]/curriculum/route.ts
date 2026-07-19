import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson } from '@/lib/teacher-course-builder';

export async function GET(
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

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, curriculumJson')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const curriculum = parseCurriculumJson(course.curriculumJson);

    return NextResponse.json({ courseId, curriculum });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { curriculum } = body;

    if (!Array.isArray(curriculum)) {
      return NextResponse.json({ error: 'curriculum must be an array.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('Course')
      // @ts-ignore
      .update({
        curriculumJson: JSON.stringify(curriculum),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[teacher/curriculum] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
