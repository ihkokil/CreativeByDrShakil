import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth'
import { order as orderSchema, course as courseSchema, payment as paymentSchema } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await db.select().from(orderSchema).where(eq(orderSchema.userId, payload.sub)).orderBy(desc(orderSchema.createdAt));

    let ordersWithRelations = orders;
    if (orders.length > 0) {
      const courseIds = [...new Set(orders.map(o => o.courseId))];
      const orderIds = orders.map(o => o.id);
      const [courses, payments] = await Promise.all([
        courseIds.length ? db.select().from(courseSchema).where(inArray(courseSchema.id, courseIds)) : Promise.resolve([]),
        orderIds.length ? db.select().from(paymentSchema).where(inArray(paymentSchema.orderId, orderIds)) : Promise.resolve([]),
      ]);
      const courseMap = new Map(courses.map(c => [c.id, c]));
      const paymentMap = new Map<string, any[]>();
      for (const p of payments) {
        const arr = paymentMap.get(p.orderId) || [];
        arr.push(p);
        paymentMap.set(p.orderId, arr);
      }
      ordersWithRelations = orders.map(o => ({
        ...o,
        course: courseMap.get(o.courseId) || null,
        payments: paymentMap.get(o.id) || [],
      }));
    }

    return NextResponse.json(ordersWithRelations)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
