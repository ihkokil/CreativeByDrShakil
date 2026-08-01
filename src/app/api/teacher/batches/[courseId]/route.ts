import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { ensureCustomBatch } from '@/lib/enrollment';

// GET batches for a specific course

export async function GET(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const supabase = getSupabaseAdmin();
    
    // Verify course access
    let courseQuery = supabase.from('Course').select('id, title, teacherId, releaseMode').eq('id', courseId).limit(1).maybeSingle();
    const { data: course, error: courseError } = await courseQuery;
    
    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Ensure Custom Batch exists for this course
    await ensureCustomBatch(supabase, courseId);

    // Fetch batches and their enrollments (Orders)
    const { data: batches, error: batchError } = await (supabase as any)
      .from('Batch')
      .select('*, orders:Order(id)')
      .eq('courseId', courseId)
      .order('startDate', { ascending: false });
      
    if (batchError) throw batchError;

    // Format batches
    const formattedBatches = (batches || []).map((batch: any) => ({
      ...batch,
      studentCount: batch.orders ? batch.orders.length : 0,
      orders: undefined, // remove full orders array from response
    }));

    const isLinear = Boolean(course.releaseMode && course.releaseMode !== 'circular');

    return NextResponse.json({ batches: formattedBatches, course, isLinear });
  } catch (error: any) {
    console.error('Error fetching batches:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// POST create a new batch for a specific course
export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { name, startDate } = body;

    if (!name || !startDate) {
      return NextResponse.json({ error: 'Name and start date are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    
    // Verify course access
    let courseQuery = supabase.from('Course').select('id, title, teacherId, releaseMode').eq('id', courseId).limit(1).maybeSingle();
    const { data: course, error: courseError } = await courseQuery;
    
    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const isLinear = Boolean(course.releaseMode && course.releaseMode !== 'circular');
    if (isLinear) {
      return NextResponse.json(
        { error: 'Linear courses only support the Custom Batch. Creating new batches is disabled for linear courses.' },
        { status: 400 }
      );
    }

    // Calculate end date (1 year from start date)
    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);

    const newBatchId = crypto.randomUUID();
    const nowStr = new Date().toISOString();

    const newBatch = {
      id: newBatchId,
      name,
      courseId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const { error: insertError } = await (supabase as any).from('Batch').insert(newBatch as any);
    
    if (insertError) throw insertError;

    return NextResponse.json({ success: true, batch: newBatch });
  } catch (error: any) {
    console.error('Error creating batch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

