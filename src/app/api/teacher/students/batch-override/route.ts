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
    const { courseId, overrides } = body;

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { action, userId, userIds, startDate } = body;

    // Determine target users
    let targets: string[] = [];
    if (userId) targets.push(userId);
    if (userIds && Array.isArray(userIds)) targets.push(...userIds);
    if (targets.length === 0) {
      // If handling old style overrides
      if (!Array.isArray(body.overrides)) {
        return NextResponse.json({ error: 'User target or overrides array is required.' }, { status: 400 });
      }
    }

    if (action) {
      if (action === 'start_from_today' || action === 'custom_date') {
        for (const uid of targets) {
          // Only update enrolledAt if it's custom_date
          if (action === 'custom_date' && startDate) {
            const newDate = new Date(startDate).toISOString();
            await supabase
              .from('Order')
              .update({ enrolledAt: newDate })
              .eq('courseId', courseId)
              .eq('userId', uid)
              .eq('status', 'approved');
          }

          // Delete existing overrides so they fallback to inheriting default schedule
          await supabase
            .from('StudentModuleAvailability')
            .delete()
            .eq('courseId', courseId)
            .eq('userId', uid);
        }
        return NextResponse.json({ success: true, processed: targets.length });
      }
      
      if (action === 'unlock_all') {
        // Fetch course curriculum to get all node IDs
        const { data: courseData } = await supabase
          .from('Course')
          .select('curriculumJson')
          .eq('id', courseId)
          .single();
          
        if (courseData && courseData.curriculumJson) {
          let nodes = [];
          try {
             nodes = typeof courseData.curriculumJson === 'string' ? JSON.parse(courseData.curriculumJson) : courseData.curriculumJson;
          } catch(e) {}
          
          const lessonNodeIds: string[] = [];
          const extractIds = (list: any[]) => {
            for (const n of list) {
              if (n.id) lessonNodeIds.push(n.id);
              if (n.children) extractIds(n.children);
            }
          };
          if (Array.isArray(nodes)) extractIds(nodes);

          const nowStr = new Date().toISOString();
          let processed = 0;
          for (const uid of targets) {
             // Clear existing overrides
             await supabase
               .from('StudentModuleAvailability')
               .delete()
               .eq('courseId', courseId)
               .eq('userId', uid);
               
             // Insert 'available' for all nodes
             const inserts = lessonNodeIds.map(nodeId => ({
               id: crypto.randomUUID(),
               courseId,
               userId: uid,
               lessonNodeId: nodeId,
               availabilityMode: 'available',
               availableAt: null,
               createdAt: nowStr,
               updatedAt: nowStr
             }));
             
             // Insert in chunks if needed, but supabase JS client can handle moderate arrays
             if (inserts.length > 0) {
// @ts-ignore
               await supabase.from('StudentModuleAvailability').insert(inserts);
             }
             processed++;
          }
          return NextResponse.json({ success: true, processed });
        }
        return NextResponse.json({ error: 'Failed to process unlock_all' }, { status: 500 });
      }
      
      // Fallback for unsupported actions
      return NextResponse.json({ error: 'Unsupported action type.' }, { status: 400 });
    }

    // Handle legacy overrides array format
    if (!Array.isArray(overrides)) {
      return NextResponse.json({ error: 'overrides must be an array.' }, { status: 400 });
    }

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
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);
      } else {
        await supabase
          .from('StudentModuleAvailability')
          .delete()
          .eq('courseId', courseId)
          .eq('userId', userId)
          .eq('lessonNodeId', lessonNodeId);

        const nowStr = new Date().toISOString();
        const { error: insertError } = await supabase.from('StudentModuleAvailability')
// @ts-ignore
.insert({
          id: crypto.randomUUID(),
          courseId,
          userId,
          lessonNodeId,
          availabilityMode: availabilityMode || 'available',
          availableAt: availableAt ? new Date(availableAt).toISOString() : null,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);
        if (insertError) throw insertError;
      }
      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error('[teacher/students/batch-override] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
