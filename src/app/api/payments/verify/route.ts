import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, payment as paymentSchema, user as userSchema, course as courseSchema } from '@/db/schema';
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
    const order = (await db.select().from(orderSchema).where(eq(orderSchema.id, orderId)).limit(1))[0] as any;

    if (!order) {
      return NextResponse.redirect(new URL('/verify-payment?status=error&message=Order not found', request.url));
    }

    const [payments, user, course] = await Promise.all([
      db.select().from(paymentSchema).where(eq(paymentSchema.orderId, orderId)),
      db.select().from(userSchema).where(eq(userSchema.id, order.userId)).limit(1).then(r => r[0] || null),
      db.select().from(courseSchema).where(eq(courseSchema.id, order.courseId)).limit(1).then(r => r[0] || null),
    ]);
    order.payments = payments;
    order.user = user;
    order.course = course;

    if (order.status !== 'pending') {
      return NextResponse.redirect(new URL(`/verify-payment?status=info&message=This order is already ${order.status}`, request.url));
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';

    // neon-http driver does not support transactions — execute sequentially.
    await db.update(orderSchema).set({ status: nextStatus }).where(eq(orderSchema.id, orderId));
    if (order.payments?.length) {
      await db.update(paymentSchema).set({
          status: nextStatus,
          approvedAt: action === 'approve' ? new Date().toISOString() : null,
      }).where(eq(paymentSchema.orderId, orderId));
    }

    // If approved, handle enrollment (including Basics bundle)
    if (action === 'approve') {
      await ensureCourseEnrollment(
        db,
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
