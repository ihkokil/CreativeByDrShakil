import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePaymentManager } from '@/lib/admin-auth';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

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

    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      with: { payment: true, user: true, course: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const nextOrderStatus = decision === 'approve' ? 'approved' : 'rejected';
    const nextPaymentStatus = decision === 'approve' ? 'approved' : 'rejected';

    await db.update(schema.orders).set({ status: nextOrderStatus }).where(eq(schema.orders.id, orderId));
    const updatedOrder = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });

    if (order.payment) {
      await db.update(schema.payments).set({
        status: nextPaymentStatus,
        approvedAt: decision === 'approve' ? new Date() : null,
      }).where(eq(schema.payments.orderId, orderId));
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
