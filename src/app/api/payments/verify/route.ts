import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyVerificationToken } from '@/lib/token-utils';
import { ensureCourseEnrollment } from '@/lib/enrollment';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/verify-payment?status=error&message=Missing token', request.url));
  }

  const payload = verifyVerificationToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL('/verify-payment?status=error&message=Invalid or expired token', request.url));
  }

  const { orderId, action } = payload;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: true, course: true },
    });

    if (!order) {
      return NextResponse.redirect(new URL('/verify-payment?status=error&message=Order not found', request.url));
    }

    if (order.status !== 'pending') {
      return NextResponse.redirect(new URL(`/verify-payment?status=info&message=This order is already ${order.status}`, request.url));
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: nextStatus },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            status: nextStatus,
            approvedAt: action === 'approve' ? new Date() : null,
          },
        });
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
