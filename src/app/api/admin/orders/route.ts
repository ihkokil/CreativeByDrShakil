import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, user as userSchema, course as courseSchema, payment as paymentSchema } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
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

    const orders = await db.select().from(orderSchema).where(eq(orderSchema.status, status)).orderBy(desc(orderSchema.updatedAt));

    let ordersWithRelations: any[] = orders;
    if (orders.length > 0) {
      const userIds = [...new Set(orders.map(o => o.userId))];
      const courseIds = [...new Set(orders.map(o => o.courseId))];
      const orderIds = orders.map(o => o.id);
      const [users, courses, payments] = await Promise.all([
        userIds.length ? db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email }).from(userSchema).where(inArray(userSchema.id, userIds)) : Promise.resolve([]),
        courseIds.length ? db.select({ id: courseSchema.id, title: courseSchema.title, slug: courseSchema.slug }).from(courseSchema).where(inArray(courseSchema.id, courseIds)) : Promise.resolve([]),
        orderIds.length ? db.select({ orderId: paymentSchema.orderId, phoneNumber: paymentSchema.phoneNumber, transactionId: paymentSchema.transactionId, amount: paymentSchema.amount, status: paymentSchema.status, submittedAt: paymentSchema.submittedAt }).from(paymentSchema).where(inArray(paymentSchema.orderId, orderIds)) : Promise.resolve([]),
      ]);
      const userMap = new Map(users.map(u => [u.id, u]));
      const courseMap = new Map(courses.map(c => [c.id, c]));
      const paymentMap = new Map<string, any[]>();
      for (const p of payments) {
        const arr = paymentMap.get(p.orderId) || [];
        arr.push(p);
        paymentMap.set(p.orderId, arr);
      }
      ordersWithRelations = orders.map(o => ({
        ...o,
        user: userMap.get(o.userId) || null,
        course: courseMap.get(o.courseId) || null,
        payments: paymentMap.get(o.id) || [],
      }));
    }

    return NextResponse.json({ orders: ordersWithRelations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
