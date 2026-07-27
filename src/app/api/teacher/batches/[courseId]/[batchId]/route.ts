import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

// GET students for a specific batch
export async function GET(request: NextRequest, { params }: { params: { courseId: string; batchId: string } }) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId, batchId } = params;
    const supabase = getSupabaseAdmin();
    
    // Verify course access
    let courseQuery = supabase.from('Course').select('id, title, teacherId').eq('id', courseId).limit(1).maybeSingle();
    const { data: course, error: courseError } = await courseQuery;
    
    if (courseError) throw courseError;
    if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    if (payload.role !== 'admin' && course.teacherId !== payload.sub) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Fetch batch details
    const { data: batch, error: batchError } = await (supabase as any).from('Batch').select('*').eq('id', batchId).limit(1).maybeSingle();
    if (batchError) throw batchError;
    if (!batch) return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });

    // Fetch orders (enrollments) for this batch
    const { data: orders, error: ordersError } = await (supabase as any)
      .from('Order')
      .select('*, user:User(id, fullName, email, phone)')
      .eq('batchId', batchId)
      .eq('status', 'approved')
      .order('enrolledAt', { ascending: false });
      
    if (ordersError) throw ordersError;

    const students = (orders || []).map(order => ({
      id: order.user?.id,
      fullName: order.user?.fullName,
      email: order.user?.email,
      phone: order.user?.phone,
      orderId: order.id,
      enrolledAt: order.enrolledAt,
    }));

    return NextResponse.json({ batch, students });
  } catch (error: any) {
    console.error('Error fetching batch students:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
