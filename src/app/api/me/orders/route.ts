import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawOrders = await db.query.orders.findMany({
      where: eq(schema.orders.userId, payload.sub),
      orderBy: [desc(schema.orders.createdAt)],
    })

    const courseIds = [...new Set(rawOrders.map(o => o.courseId).filter(Boolean))] as string[];
    const orderIds = rawOrders.map(o => o.id);

    const [courses, payments] = await Promise.all([
      courseIds.length > 0
        ? db.query.courses.findMany({ where: inArray(schema.courses.id, courseIds) })
        : Promise.resolve([]),
      orderIds.length > 0
        ? db.query.payments.findMany({ where: inArray(schema.payments.orderId, orderIds) })
        : Promise.resolve([]),
    ]);

    const courseMap = new Map(courses.map(c => [c.id, c]));
    const paymentMap = new Map(payments.map(p => [p.orderId, p]));

    const orders = rawOrders.map(order => ({
      ...order,
      course: courseMap.get(order.courseId) || null,
      payment: paymentMap.get(order.id) || null,
    }));

    return NextResponse.json(orders)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
