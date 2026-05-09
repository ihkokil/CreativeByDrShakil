import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePaymentManager } from '@/lib/admin-auth';

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

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, user: true, course: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const nextOrderStatus = decision === 'approve' ? 'approved' : 'rejected';
    const nextPaymentStatus = decision === 'approve' ? 'approved' : 'rejected';

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextOrderStatus,
        },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { orderId },
          data: {
            status: nextPaymentStatus,
            approvedAt: decision === 'approve' ? new Date() : null,
          },
        });
      }

      // If approved and the course is one of the special bundles, grant Basic for free
      if (decision === 'approve' && order.course) {
        const bundledTitles = [
          'Medicine and Allied',
          'Surgery and Allied',
          'Gyane & Obsetrics',
          'Radiology',
          'Dermatology',
        ];

        if (bundledTitles.includes(order.course.title)) {
          const basicCourse = await tx.course.findFirst({
            where: {
              OR: [{ slug: 'basic' }, { title: 'Basic' }],
            },
          });

          if (basicCourse) {
            await tx.order.upsert({
              where: {
                userId_courseId: {
                  userId: order.userId,
                  courseId: basicCourse.id,
                },
              },
              update: {
                status: 'approved',
                totalAmount: 0,
              },
              create: {
                userId: order.userId,
                courseId: basicCourse.id,
                status: 'approved',
                totalAmount: 0,
              },
            });
          }
        }
      }

      return updatedOrder;
    });

    return NextResponse.json({ order: updated, decision });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
