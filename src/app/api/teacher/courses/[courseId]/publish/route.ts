import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

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
    const body = await request.json();
    const { action } = body; // 'publish' or 'unpublish'

    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, status')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const nowStr = new Date().toISOString();

    if (action === 'publish') {
      const { error: updateError } = await supabase
        .from('Course')
        // @ts-ignore
        .update({
          status: 'published',
          publishedAt: nowStr,
          updatedAt: nowStr,
        })
        .eq('id', courseId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, status: 'published' });
    } else if (action === 'unpublish' || action === 'draft') {
      const { error: updateError } = await supabase
        .from('Course')
        // @ts-ignore
        .update({
          status: 'draft',
          publishedAt: null,
          updatedAt: nowStr,
        })
        .eq('id', courseId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, status: 'draft' });
    } else if (action === 'archive') {
      const { error: updateError } = await supabase
        .from('Course')
        // @ts-ignore
        .update({
          status: 'archived',
          updatedAt: nowStr,
        })
        .eq('id', courseId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, status: 'archived' });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "publish", "unpublish", or "archive".' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[teacher/publish] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
