import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { sendPaymentVerificationEmail } from '@/lib/payment-emails';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, transactionId, phoneNumber } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }
    if (!transactionId || typeof transactionId !== 'string') {
      return NextResponse.json({ error: 'transactionId is required.' }, { status: 400 });
    }
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'phoneNumber is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Verify the order exists and belongs to this user
    const { data: order, error: orderError }: { data: any; error: any } = await supabase
      .from('Order')
      .select('*')
      .eq('id', orderId)
      .eq('userId', payload.sub)
      .limit(1)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'approved') {
      return NextResponse.json({ error: 'This order has already been approved.' }, { status: 409 });
    }

    // Create payment record
    const nowStr = new Date().toISOString();
    const paymentId = nanoid();

    const { error: paymentError } = await supabase.from('Payment')
// @ts-ignore
.insert({
      id: paymentId,
      orderId,
      transactionId: transactionId.trim(),
      phoneNumber: phoneNumber.trim(),
      amount: order.totalAmount || order.amount || 0,
      status: 'pending',
      submittedAt: nowStr,
      createdAt: nowStr,
    } as any);

    if (paymentError) throw paymentError;

    // Update order status
    const { error: updateError } = await supabase
      .from('Order')
      // @ts-ignore
      .update({ updatedAt: nowStr })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Get course and user info for verification email
    const [courseRes, userRes] = await Promise.all([
      order.courseId
        ? supabase.from('Course').select('id, title').eq('id', order.courseId).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('User').select('id, fullName, email').eq('id', payload.sub).limit(1).maybeSingle(),
    ]);

    const course = courseRes.data as any;
    const user = userRes.data as any;

    // Send verification email to admin
    if (course && user) {
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.PAYMENT_NOTIFICATION_EMAIL;
        if (adminEmail) {
          await sendPaymentVerificationEmail({
            to: adminEmail,
            studentName: user.fullName || 'Unknown',
            courseTitle: course.title || 'Unknown',
            amount: order.totalAmount || order.amount || 0,
            transactionId: transactionId.trim(),
            phoneNumber: phoneNumber.trim(),
            orderId,
          });
        }
      } catch (emailErr) {
        console.error('[payments/submit] Email notification failed:', emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      paymentId,
      message: 'Payment submitted successfully. Awaiting verification.',
    });
  } catch (error: any) {
    console.error('[payments/submit] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
