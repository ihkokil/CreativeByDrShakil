import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId } = await request.json()
    const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, String(courseId)) })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const existingOrder = await db.query.orders.findFirst({
      where: and(eq(schema.orders.userId, session.user.id), eq(schema.orders.courseId, resolvedCourseId))
    })

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS)

    if (existingOrder?.status === 'approved' && existingOrder.updatedAt >= oneYearAgo) {
      return NextResponse.json({ error: 'You already own this course' }, { status: 400 })
    }

    const totalAmount = course.price
    let order;
    if (existingOrder) {
      await db.update(schema.orders)
        .set({
          status: 'pending',
          totalAmount: totalAmount,
        })
        .where(eq(schema.orders.id, existingOrder.id));
      
      const ord = await db.query.orders.findFirst({
        where: eq(schema.orders.id, existingOrder.id),
      });
      order = ord ? { ...ord, course } : null;
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(schema.orders).values({
        id: newOrderId,
        userId: session.user.id,
        courseId: resolvedCourseId,
        totalAmount: totalAmount,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const ord = await db.query.orders.findFirst({
        where: eq(schema.orders.id, newOrderId),
      });
      order = ord ? { ...ord, course } : null;
    }
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
