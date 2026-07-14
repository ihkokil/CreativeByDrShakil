import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, payment as paymentSchema, user as userSchema, course as courseSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requirePaymentManager } from '@/lib/admin-auth';
import { ensureCourseEnrollment } from '@/lib/enrollment';

type Decision = 'approve' | 'reject';

export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const adminCheck = await requirePaymentManager(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { orderId } = await params;
    const body = await request.json();
    const decision = String(body?.decision || '').toLowerCase() as Decision;

    if (decision !== 'approve' && decision !== 'reject') {
      return NextResponse.json({ error: 'Invalid decision. Use approve or reject.' }, { status: 400 });
    }

    const order = (await db.select().from(orderSchema).where(eq(orderSchema.id, orderId)).limit(1))[0] as any;

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const [payments, user, course] = await Promise.all([
      db.select().from(paymentSchema).where(eq(paymentSchema.orderId, orderId)),
      db.select().from(userSchema).where(eq(userSchema.id, order.userId)).limit(1).then(r => r[0] || null),
      db.select().from(courseSchema).where(eq(courseSchema.id, order.courseId)).limit(1).then(r => r[0] || null),
    ]);
    order.payments = payments;
    order.user = user;
    order.course = course;

    const nextOrderStatus = decision === 'approve' ? 'approved' : 'rejected';
    const nextPaymentStatus = decision === 'approve' ? 'approved' : 'rejected';

    // neon-http driver does not support transactions — execute sequentially.
    await db.update(orderSchema).set({
      status: nextOrderStatus,
    }).where(eq(orderSchema.id, orderId));

    const [updatedOrder] = await db.select().from(orderSchema).where(eq(orderSchema.id, orderId)).limit(1);

    if (order.payments?.length) {
      await db.update(paymentSchema).set({
          status: nextPaymentStatus,
          approvedAt: decision === 'approve' ? new Date().toISOString() : null,
      }).where(eq(paymentSchema.orderId, orderId));
    }

    // If approved, handle enrollment (including Basics bundle)
    if (decision === 'approve' && order.course) {
      await ensureCourseEnrollment(
        db,
        order.userId,
        order.course.id,
        order.course.title,
        order.course.slug
      );
    }

    return NextResponse.json({ order: updatedOrder, decision });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
