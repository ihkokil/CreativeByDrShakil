import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

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
    const supabase = getSupabase();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.description !== undefined) updateData.description = typeof body.description === 'string' ? body.description.trim() : null;
    if (body.overview !== undefined) updateData.overview = typeof body.overview === 'string' ? body.overview.trim() || null : null;
    if (body.learningOutcomes !== undefined) updateData.learningOutcomes = typeof body.learningOutcomes === 'string' ? body.learningOutcomes.trim() || null : null;
    if (body.imageUrl !== undefined) updateData.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() || null : null;

    if (Object.keys(updateData).length <= 1) {
      return NextResponse.json({ error: 'No content fields to update.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('Course')
      // @ts-ignore
      .update(updateData)
      .eq('id', courseId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[teacher/content] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
