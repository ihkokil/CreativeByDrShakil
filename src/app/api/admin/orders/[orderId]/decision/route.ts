import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requirePaymentManager } from '@/lib/admin-auth';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { sendTelegramEnrollmentNotification } from '@/lib/telegram';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const adminCheck = await requirePaymentManager(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { orderId } = await params;
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

    // Fetch related user and course
    const [userRes, courseRes, paymentsRes] = await Promise.all([
      order.userId
        ? supabase.from('User').select('id, fullName, email, phone').eq('id', order.userId).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      order.courseId
        ? supabase.from('Course').select('id, title, slug').eq('id', order.courseId).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('Payment').select('*').eq('orderId', orderId),
    ]);

    return NextResponse.json({
      order: {
        ...order,
        user: userRes.data || null,
        course: courseRes.data || null,
        payments: paymentsRes.data || [],
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/orders/[orderId]/decision error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const adminCheck = await requirePaymentManager(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { orderId } = await params;
    const body = await request.json();
    const { decision, reason } = body;

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision. Must be "approve" or "reject".' }, { status: 400 });
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

    if (order.status === 'approved') {
      return NextResponse.json({ error: 'This order has already been approved.' }, { status: 409 });
    }

    const nowStr = new Date().toISOString();

    if (decision === 'approve') {
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

      // Fetch course and student info for enrollment
      const [courseRes, studentRes] = await Promise.all([
        order.courseId
          ? supabase.from('Course').select('id, title, slug').eq('id', order.courseId).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
        order.userId
          ? supabase.from('User').select('id, fullName, email').eq('id', order.userId).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const course = courseRes.data as any;
      const student = studentRes.data as any;

      // Send Telegram enrollment notification
      if (course && student) {
        try {
          await sendTelegramEnrollmentNotification({
            studentName: student.fullName || 'Unknown',
            studentEmail: student.email || '',
            courseTitle: course.title || 'Unknown Course',
            enrolledByAdmin: false,
          });
        } catch (notifErr) {
          console.error('[admin/orders/decision] Telegram notification failed:', notifErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Order approved and student enrolled.',
        order: { ...order, status: 'approved', enrolledAt: nowStr },
      });
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

      return NextResponse.json({
        success: true,
        message: 'Order rejected.',
        order: { ...order, status: 'rejected' },
      });
    }
  } catch (error: any) {
    console.error('POST /api/admin/orders/[orderId]/decision error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
