import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
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
    const orderRecord = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
    });

    if (!orderRecord) {
      return NextResponse.redirect(new URL('/verify-payment?status=error&message=Order not found', request.url));
    }

    const [payment, user, course] = await Promise.all([
      db.query.payments.findFirst({ where: eq(schema.payments.orderId, orderRecord.id) }),
      db.query.users.findFirst({ where: eq(schema.users.id, orderRecord.userId) }),
      db.query.courses.findFirst({ where: eq(schema.courses.id, orderRecord.courseId) }),
    ]);

    if (!user || !course) {
      return NextResponse.redirect(new URL('/verify-payment?status=error&message=Order relations not found', request.url));
    }

    const order = {
      ...orderRecord,
      payment: payment || null,
      user,
      course,
    };

    if (order.status !== 'pending') {
      return NextResponse.redirect(new URL(`/verify-payment?status=info&message=This order is already ${order.status}`, request.url));
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';

    await db.transaction(async (tx) => {
      await tx.update(schema.orders)
        .set({ status: nextStatus })
        .where(eq(schema.orders.id, orderId));

      if (order.payment) {
        await tx.update(schema.payments)
          .set({
            status: nextStatus,
            approvedAt: action === 'approve' ? new Date() : null,
          })
          .where(eq(schema.payments.orderId, orderId));
      }
    });

    // If approved, handle enrollment (including Basics bundle)
    if (action === 'approve') {
      await ensureCourseEnrollment(
        db as any,
        order.userId,
        order.course.id,
        order.course.title,
        order.course.slug
      );
    }

    return NextResponse.redirect(new URL(`/verify-payment?status=success&action=${action}&student=${encodeURIComponent(order.user.fullName)}&course=${encodeURIComponent(order.course.title)}`, request.url));
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL(`/verify-payment?status=error&message=${encodeURIComponent(error.message)}`, request.url));
  }
}
