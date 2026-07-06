import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePaymentManager } from '@/lib/admin-auth';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

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

    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.status, status),
      with: {
        user: {
          columns: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        course: {
          columns: {
            id: true,
            title: true,
            slug: true,
          },
        },
        payment: {
          columns: {
            phoneNumber: true,
            transactionId: true,
            amount: true,
            status: true,
            submittedAt: true,
          },
        },
      },
      orderBy: [desc(schema.orders.updatedAt)],
    });

    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
