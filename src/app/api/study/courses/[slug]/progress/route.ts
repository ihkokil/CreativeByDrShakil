import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { slug } = await params;
    const supabase = getSupabase();

    const { data: course, error: courseError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const { data: progressRows = [] } = await supabase
      .from('LessonProgress')
      .select('lessonNodeId, completedAt')
      .eq('userId', payload.sub)
      .eq('courseId', course.id);

    return NextResponse.json({
      courseId: course.id,
      completedLessons: (progressRows || []).map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        completedAt: row.completedAt,
      })),
    });
  } catch (error: any) {
    console.error('[study/progress] GET error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const { lessonNodeId } = body;

    if (!lessonNodeId || typeof lessonNodeId !== 'string') {
      return NextResponse.json({ error: 'lessonNodeId is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: course, error: courseError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check if progress already exists
    const { data: existing }: { data: any } = await supabase
      .from('LessonProgress')
      .select('id')
      .eq('userId', payload.sub)
      .eq('courseId', course.id)
      .eq('lessonNodeId', lessonNodeId)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const nowStr = new Date().toISOString();
      const { error: insertError } = await supabase.from('LessonProgress')
// @ts-ignore
.insert({
        id: nanoid(),
        userId: payload.sub,
        courseId: course.id,
        lessonNodeId,
        completedAt: nowStr,
        createdAt: nowStr,
      } as any);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, lessonNodeId });
  } catch (error: any) {
    console.error('[study/progress] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const { lessonNodeId } = body;

    if (!lessonNodeId || typeof lessonNodeId !== 'string') {
      return NextResponse.json({ error: 'lessonNodeId is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    await supabase
      .from('LessonProgress')
      .delete()
      .eq('userId', payload.sub)
      .eq('courseId', course.id)
      .eq('lessonNodeId', lessonNodeId);

    return NextResponse.json({ success: true, lessonNodeId });
  } catch (error: any) {
    console.error('[study/progress] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
