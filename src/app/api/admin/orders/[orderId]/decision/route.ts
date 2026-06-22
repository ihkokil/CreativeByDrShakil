import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, payment as paymentSchema } from '@/db/schema';
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

    const order = await db.query.order.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
      with: { payments: true, user: true, course: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const nextOrderStatus = decision === 'approve' ? 'approved' : 'rejected';
    const nextPaymentStatus = decision === 'approve' ? 'approved' : 'rejected';

    const updated = await db.transaction(async (tx) => {
      const [updatedOrder] = await tx.update(orderSchema).set({
        status: nextOrderStatus,
      }).where(eq(orderSchema.id, orderId)).returning();

      if (order.payments?.length) {
        await tx.update(paymentSchema).set({
            status: nextPaymentStatus,
            approvedAt: decision === 'approve' ? new Date().toISOString() : null,
        }).where(eq(paymentSchema.orderId, orderId));
      }

      // If approved, handle enrollment (including Basics bundle)
      if (decision === 'approve' && order.course) {
        await ensureCourseEnrollment(
          tx,
          order.userId,
          order.course.id,
          order.course.title,
          order.course.slug
        );
      }

      return updatedOrder;
    });

    return NextResponse.json({ order: updated, decision });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
