import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { requireTeacherPayload } from '@/lib/route-auth';
import type { Database } from '@/types/supabase';

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

    const supabase = getSupabaseAdmin();

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

    const updateData: Database['public']['Tables']['Order']['Update'] = {
      updatedAt: new Date().toISOString(),
    };

    if (enrolledAt !== undefined) {
      updateData.enrolledAt = enrolledAt ? new Date(enrolledAt).toISOString() : null;
      if (updateData.enrolledAt) {
        const oneYearLater = new Date(updateData.enrolledAt);
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        updateData.expiresAt = oneYearLater.toISOString();
      }
    }

    if (expiresAt !== undefined && !updateData.expiresAt) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;
    }

    const { error: updateError } = await supabase
      .from('Order')
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
