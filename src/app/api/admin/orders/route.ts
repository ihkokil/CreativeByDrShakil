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
      orderBy: [desc(schema.orders.updatedAt)],
    });

    // Batch-fetch related data (MariaDB-compatible flat queries)
    const userIds = [...new Set(orders.map(o => o.userId).filter(Boolean))] as string[];
    const courseIds = [...new Set(orders.map(o => o.courseId).filter(Boolean))] as string[];
    const orderIds = orders.map(o => o.id);

    const [usersData, coursesData, paymentsData] = await Promise.all([
      userIds.length > 0
        ? db.query.users.findMany({ where: inArray(schema.users.id, userIds), columns: { id: true, fullName: true, email: true } })
        : [],
      courseIds.length > 0
        ? db.query.courses.findMany({ where: inArray(schema.courses.id, courseIds), columns: { id: true, title: true, slug: true } })
        : [],
      orderIds.length > 0
        ? db.query.payments.findMany({ where: inArray(schema.payments.orderId, orderIds), columns: { orderId: true, phoneNumber: true, transactionId: true, amount: true, status: true, submittedAt: true } })
        : [],
    ]);

    const userMap = new Map(usersData.map(u => [u.id, u]));
    const courseMap = new Map(coursesData.map(c => [c.id, c]));
    const paymentMap = new Map(paymentsData.map(p => [p.orderId, p]));

    const ordersWithRelations = orders.map(o => ({
      ...o,
      user: userMap.get(o.userId) ?? null,
      course: courseMap.get(o.courseId) ?? null,
      payment: paymentMap.get(o.id) ?? null,
    }));

    return NextResponse.json({ orders: ordersWithRelations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
