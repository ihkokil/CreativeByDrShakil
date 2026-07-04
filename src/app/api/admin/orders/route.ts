import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePaymentManager } from '@/lib/admin-auth';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requirePaymentManager(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const requestedStatus = (searchParams.get('status') || 'pending').toLowerCase();
    const status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : 'pending';

    const orders = await db.order.findMany({
      where: { status },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        payment: {
          select: {
            phoneNumber: true,
            transactionId: true,
            amount: true,
            status: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
