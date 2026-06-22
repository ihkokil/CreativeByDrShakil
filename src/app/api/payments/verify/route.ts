import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, payment as paymentSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyVerificationToken } from '@/lib/token-utils';
import { ensureCourseEnrollment } from '@/lib/enrollment';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/verify-payment?status=error&message=Missing token', request.url));
  }

  const payload = await verifyVerificationToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/verify-payment?status=error&message=Invalid or expired token', request.url));
  }

  const { orderId, action } = payload;

  try {
    const order = await db.query.order.findFirst({
      where: (o, { eq }) => eq(o.id, orderId),
      with: { payments: true, user: true, course: true },
    });

    if (!order) {
      return NextResponse.redirect(new URL('/verify-payment?status=error&message=Order not found', request.url));
    }

    if (order.status !== 'pending') {
      return NextResponse.redirect(new URL(`/verify-payment?status=info&message=This order is already ${order.status}`, request.url));
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.transaction(async (tx) => {
      await tx.update(orderSchema).set({ status: nextStatus }).where(eq(orderSchema.id, orderId));
      if (order.payments?.length) {
        await tx.update(paymentSchema).set({
            status: nextStatus,
            approvedAt: action === 'approve' ? new Date().toISOString() : null,
        }).where(eq(paymentSchema.orderId, orderId));
      }

      // If approved, handle enrollment (including Basics bundle)
      if (action === 'approve') {
        await ensureCourseEnrollment(
          tx,
          order.userId,
          order.course.id,
          order.course.title,
          order.course.slug
        );
      }
    });

    return NextResponse.redirect(new URL(`/verify-payment?status=success&action=${action}&student=${encodeURIComponent(order.user.fullName)}&course=${encodeURIComponent(order.course.title)}`, request.url));
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL(`/verify-payment?status=error&message=${encodeURIComponent(error.message)}`, request.url));
  }
}
