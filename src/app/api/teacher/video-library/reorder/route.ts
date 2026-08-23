import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds, id, targetIndex, direction } = body || {};

    const supabase = getSupabaseAdmin();
    const nowStr = new Date().toISOString();

    // Mode 1: Explicit array of ordered node IDs
    if (Array.isArray(orderedIds)) {
      for (let i = 0; i < orderedIds.length; i++) {
        const nodeId = orderedIds[i];
        if (typeof nodeId !== 'string') continue;

        const { error: updateError } = await supabase
          .from('VideoLibraryNode')
          // @ts-ignore
          .update({ sortOrder: i, updatedAt: nowStr })
          .eq('id', nodeId);

        if (updateError) throw updateError;
      }
      return NextResponse.json({ success: true });
    }

    // Mode 2 & 3: Single item move by targetIndex or direction ('up' | 'down')
    if (id && (typeof targetIndex === 'number' || direction === 'up' || direction === 'down')) {
      // 1. Fetch current node to find its parentId
      const { data: currentNode, error: currentError } = await supabase
        .from('VideoLibraryNode')
        .select('id, parentId, sortOrder')
        .eq('id', id)
        .limit(1)
        .maybeSingle();

      if (currentError || !currentNode) {
        return NextResponse.json({ error: 'Node not found.' }, { status: 404 });
      }

      // 2. Fetch all sibling nodes with the same parent
      let query = supabase
        .from('VideoLibraryNode')
        .select('id, sortOrder')
        .order('sortOrder', { ascending: true })
        .order('createdAt', { ascending: true });

      if (currentNode.parentId) {
        query = query.eq('parentId', currentNode.parentId);
      } else {
        query = query.is('parentId', null);
      }

      const { data: siblings = [], error: sibError } = await query;
      if (sibError) throw sibError;

      const siblingIds = (siblings || []).map((s: any) => s.id);
      const currentIndex = siblingIds.indexOf(id);
      if (currentIndex === -1) {
        return NextResponse.json({ error: 'Node not found among siblings.' }, { status: 404 });
      }

      let newSiblingIds = [...siblingIds];

      if (typeof targetIndex === 'number') {
        newSiblingIds.splice(currentIndex, 1);
        const clampedIndex = Math.max(0, Math.min(targetIndex, newSiblingIds.length));
        newSiblingIds.splice(clampedIndex, 0, id);
      } else if (direction === 'up' && currentIndex > 0) {
        const temp = newSiblingIds[currentIndex - 1];
        newSiblingIds[currentIndex - 1] = newSiblingIds[currentIndex];
        newSiblingIds[currentIndex] = temp;
      } else if (direction === 'down' && currentIndex < newSiblingIds.length - 1) {
        const temp = newSiblingIds[currentIndex + 1];
        newSiblingIds[currentIndex + 1] = newSiblingIds[currentIndex];
        newSiblingIds[currentIndex] = temp;
      }

      // 3. Batch update sortOrder for all siblings
      for (let i = 0; i < newSiblingIds.length; i++) {
        const sId = newSiblingIds[i];
        const { error: updateError } = await supabase
          .from('VideoLibraryNode')
          // @ts-ignore
          .update({ sortOrder: i, updatedAt: nowStr })
          .eq('id', sId);

        if (updateError) throw updateError;
      }

      return NextResponse.json({ success: true, orderedIds: newSiblingIds });
    }

    return NextResponse.json({ 
      error: 'Invalid payload. Provide orderedIds array, or id with targetIndex / direction.' 
    }, { status: 400 });
  } catch (error: any) {
    console.error('[teacher/video-library/reorder] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

