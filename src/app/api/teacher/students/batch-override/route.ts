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
    const { courseId, overrides } = body;

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }
    if (!Array.isArray(overrides)) {
      return NextResponse.json({ error: 'overrides must be an array.' }, { status: 400 });
    }

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

    let processed = 0;

    for (const override of overrides) {
      const { userId, lessonNodeId, availabilityMode, availableAt } = override;

      if (!userId || !lessonNodeId) continue;

      if (availabilityMode === 'inherit') {
        // Delete the override
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);
      } else {
        // Delete existing then insert
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);

        await supabase.from('StudentModuleAvailability')
// @ts-ignore
.insert({
          id: crypto.randomUUID(),
          courseId,
          userId,
          lessonNodeId,
          availabilityMode: availabilityMode || 'available',
          availableAt: availableAt ? new Date(availableAt).toISOString() : null,
        } as any);
      }
      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error('[teacher/students/batch-override] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
