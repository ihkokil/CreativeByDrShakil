import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db';
import { order as orderSchema, course as courseSchema } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const enrichOrderWithCourse = async (orderRow: any) => {
  if (!orderRow) return null;
  const [course] = orderRow.courseId
    ? await db.select().from(courseSchema).where(eq(courseSchema.id, orderRow.courseId)).limit(1)
    : [null];
  return { ...orderRow, course: course || null };
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId } = await request.json()
    const [course] = await db.select()
      .from(courseSchema)
      .where(eq(courseSchema.id, String(courseId)))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const [existingOrder] = await db.select()
      .from(orderSchema)
      .where(and(eq(orderSchema.userId, session.user.id), eq(orderSchema.courseId, resolvedCourseId)))
      .limit(1);

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
      const [o] = await db.select().from(orderSchema).where(eq(orderSchema.id, existingOrder.id)).limit(1);
      order = await enrichOrderWithCourse(o);
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(orderSchema).values({
        id: newOrderId,
        userId: session.user.id,
        courseId: resolvedCourseId,
        totalAmount: totalAmount,
      });
      const [o] = await db.select().from(orderSchema).where(eq(orderSchema.id, newOrderId)).limit(1);
      order = await enrichOrderWithCourse(o);
    }
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
