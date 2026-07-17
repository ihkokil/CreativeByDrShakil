import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { verifyVerificationToken } from '@/lib/token-utils';
import { getAppUrl } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const appUrl = getAppUrl();

    if (!token) {
      return NextResponse.redirect(`${appUrl}/payment-result?error=missing_token`);
    }

    const tokenPayload = await verifyVerificationToken(token);
    if (!tokenPayload) {
      return NextResponse.redirect(`${appUrl}/payment-result?error=invalid_token`);
    }

    const { orderId, action } = tokenPayload;
    const supabase = getSupabase();

    const { data: order, error: orderError }: { data: any; error: any } = await supabase
      .from('Order')
      .select('*')
      .eq('id', orderId)
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return NextResponse.redirect(`${appUrl}/payment-result?error=order_not_found`);
    }

    if (order.status === 'approved') {
      return NextResponse.redirect(`${appUrl}/payment-result?status=already_approved&orderId=${orderId}`);
    }

    if (order.status === 'rejected') {
      return NextResponse.redirect(`${appUrl}/payment-result?status=already_rejected&orderId=${orderId}`);
    }

    const nowStr = new Date().toISOString();

    if (action === 'approve') {
      // Update order status
      const { error: updateError } = await supabase
        .from('Order')
        // @ts-ignore
        .update({
          status: 'approved',
          updatedAt: nowStr,
          enrolledAt: nowStr,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Update payment status
      const { error: paymentUpdateError } = await supabase
        .from('Payment')
        // @ts-ignore
        .update({
          status: 'approved',
          approvedAt: nowStr,
        })
        .eq('orderId', orderId);

      if (paymentUpdateError) {
        console.error('[payments/verify] Payment update failed:', paymentUpdateError);
      }

      // Send Telegram notification
      try {
        const { sendTelegramEnrollmentNotification } = await import('@/lib/telegram');
        const [courseRes, studentRes] = await Promise.all([
          order.courseId ? supabase.from('Course').select('title').eq('id', order.courseId).limit(1).maybeSingle() : Promise.resolve({ data: null }),
          order.userId ? supabase.from('User').select('fullName, email').eq('id', order.userId).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        const course = courseRes.data as any;
        const student = studentRes.data as any;
        if (course && student) {
          await sendTelegramEnrollmentNotification({
            studentName: student.fullName || 'Unknown',
            studentEmail: student.email || '',
            courseTitle: course.title || 'Unknown Course',
            enrolledByAdmin: false,
          });
        }
      } catch (notifErr) {
        console.error('[payments/verify] Telegram notification failed:', notifErr);
      }

      return NextResponse.redirect(`${appUrl}/payment-result?status=approved&orderId=${orderId}`);
    } else {
      // Reject
      const { error: updateError } = await supabase
        .from('Order')
        // @ts-ignore
        .update({
          status: 'rejected',
          updatedAt: nowStr,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      const { error: paymentUpdateError } = await supabase
        .from('Payment')
        // @ts-ignore
        .update({ status: 'rejected' })
        .eq('orderId', orderId);

      if (paymentUpdateError) {
        console.error('[payments/verify] Payment reject update failed:', paymentUpdateError);
      }

      return NextResponse.redirect(`${appUrl}/payment-result?status=rejected&orderId=${orderId}`);
    }
  } catch (error: any) {
    console.error('[payments/verify] error:', error);
    const appUrl = getAppUrl();
    return NextResponse.redirect(`${appUrl}/payment-result?error=server_error`);
  }
}
