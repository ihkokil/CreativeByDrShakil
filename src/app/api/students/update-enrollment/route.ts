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
    const { orderId, enrolledAt, expiresAt } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: order, error: orderError }: { data: any; error: any } = await supabase
      .from('Order')
      .select('*')
      .eq('id', orderId)
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (enrolledAt !== undefined) {
      updateData.enrolledAt = enrolledAt ? new Date(enrolledAt).toISOString() : null;
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
    }

    const { error: updateError } = await supabase
      .from('Order')
      // @ts-ignore
      .update(updateData)
      .eq('id', orderId);

    if (updateError) throw updateError;

    const { data: updatedOrder } = await supabase
      .from('Order')
      .select('*')
      .eq('id', orderId)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('[students/update-enrollment] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
