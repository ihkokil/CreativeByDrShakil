import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db';
import { order as orderSchema } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId } = await request.json()
    const course = await db.query.course.findFirst({ where: (c, { eq }) => eq(c.id, String(courseId)) })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const existingOrder = await db.query.order.findFirst({
      where: (o, { eq, and }) => and(eq(o.userId, session.user.id), eq(o.courseId, resolvedCourseId))
    })

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS)

    if (existingOrder?.status === 'approved' && existingOrder.updatedAt >= oneYearAgo.toISOString()) {
      return NextResponse.json({ error: 'You already own this course' }, { status: 400 })
    }

    const totalAmount = course.price
    let order;
    if (existingOrder) {
      await db.update(orderSchema).set({
        status: 'pending',
        totalAmount: totalAmount,
      }).where(eq(orderSchema.id, existingOrder.id));
      order = await db.query.order.findFirst({ where: (o, { eq }) => eq(o.id, existingOrder.id), with: { course: true } });
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(orderSchema).values({
        id: newOrderId,
        userId: session.user.id,
        courseId: resolvedCourseId,
        totalAmount: totalAmount,
      });
      order = await db.query.order.findFirst({ where: (o, { eq }) => eq(o.id, newOrderId), with: { course: true } });
    }
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
