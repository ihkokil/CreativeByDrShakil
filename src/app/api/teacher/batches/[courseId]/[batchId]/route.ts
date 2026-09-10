import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

type RouteContext = {
  params: Promise<{
    courseId: string;
    batchId: string;
  }>;
};

// GET students for a specific batch
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, batchId } = await params;
    const supabase = getSupabaseAdmin();

    // Verify course access
    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('id, title, teacherId')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json(
        { error: 'Course not found.' },
        { status: 404 }
      );
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Fetch batch details
    const { data: batch, error: batchError } = await (supabase as any)
      .from('Batch')
      .select('*')
      .eq('id', batchId)
      .limit(1)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return NextResponse.json(
        { error: 'Batch not found.' },
        { status: 404 }
      );
    }

    // Fetch orders (enrollments) for this batch
    const { data: orders, error: ordersError } = await (supabase as any)
      .from('Order')
      .select('*, user:User(id, fullName, email, phone)')
      .eq('batchId', batchId)
      .eq('status', 'approved')
      .order('enrolledAt', { ascending: false });

    if (ordersError) throw ordersError;

    const isSpecialBatch = batch?.name && (
      batch.name.toLowerCase().includes('instant') ||
      batch.name.toLowerCase().includes('all unlocked') ||
      batch.name.toLowerCase().includes('custom') ||
      batch.name.toLowerCase().includes('start today')
    );

    const students = (orders || []).map((order: any) => ({
      id: order.user?.id,
      fullName: order.user?.fullName,
      email: order.user?.email,
      phone: order.user?.phone,
      orderId: order.id,
      enrolledAt: (batch?.startDate && !isSpecialBatch) ? batch.startDate : order.enrolledAt,
    }));

    return NextResponse.json({ batch, students });
  } catch (error: any) {
    console.error('Error fetching batch students:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

// PUT update a batch
export async function PUT(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, batchId } = await params;
    const body = await request.json();
    const { name, startDate } = body;

    if (!name || !startDate) {
      return NextResponse.json({ error: 'Name and start date are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify course access
    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('id, title, teacherId')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Fetch existing batch
    const { data: batch, error: batchError } = await (supabase as any)
      .from('Batch')
      .select('*')
      .eq('id', batchId)
      .limit(1)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }

    const isSpecialBatch = batch?.name && (
      batch.name.toLowerCase().includes('instant') ||
      batch.name.toLowerCase().includes('all unlocked') ||
      batch.name.toLowerCase().includes('custom') ||
      batch.name.toLowerCase().includes('start today')
    );

    if (isSpecialBatch) {
      return NextResponse.json({ error: 'Default system batches cannot be edited.' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);

    const { data: updatedBatch, error: updateError } = await (supabase as any)
      .from('Batch')
      .update({
        name: name.trim(),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('id', batchId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Also sync all existing student orders in this batch to the new start/end dates
    await (supabase as any)
      .from('Order')
      .update({
        enrolledAt: start.toISOString(),
        expiresAt: end.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .eq('batchId', batchId);

    return NextResponse.json({ success: true, batch: updatedBatch });
  } catch (error: any) {
    console.error('Error updating batch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// DELETE a batch
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, batchId } = await params;
    const supabase = getSupabaseAdmin();

    // Verify course access
    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('id, title, teacherId')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Fetch existing batch
    const { data: batch, error: batchError } = await (supabase as any)
      .from('Batch')
      .select('*')
      .eq('id', batchId)
      .limit(1)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
    }

    const isSpecialBatch = batch?.name && (
      batch.name.toLowerCase().includes('instant') ||
      batch.name.toLowerCase().includes('all unlocked') ||
      batch.name.toLowerCase().includes('custom') ||
      batch.name.toLowerCase().includes('start today')
    );

    if (isSpecialBatch) {
      return NextResponse.json({ error: 'Default system batches cannot be deleted.' }, { status: 400 });
    }

    // Check if there are active enrollments / students
    const { count, error: countError } = await (supabase as any)
      .from('Order')
      .select('id', { count: 'exact', head: true })
      .eq('batchId', batchId);

    if (countError) throw countError;

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete batch "${batch.name}" because it has ${count} enrolled student(s). Unenroll or transfer students before deleting.` },
        { status: 400 }
      );
    }

    // Perform delete
    const { error: deleteError } = await (supabase as any)
      .from('Batch')
      .delete()
      .eq('id', batchId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting batch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}