import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds } = body;

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'orderedIds must be an array of node IDs.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Update sort order for each node
    for (let i = 0; i < orderedIds.length; i++) {
      const nodeId = orderedIds[i];
      if (typeof nodeId !== 'string') continue;

      await supabase
        .from('VideoLibraryNode')
        // @ts-ignore
        .update({ sortOrder: i })
        .eq('id', nodeId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[teacher/video-library/reorder] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
