import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId } = await request.json()
    const course = await db.course.findUnique({ where: { id: String(courseId) } })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const existingOrder = await db.order.findFirst({
      where: { userId: session.user.id, courseId: resolvedCourseId }
    })

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS)

    if (existingOrder?.status === 'approved' && existingOrder.updatedAt >= oneYearAgo) {
      return NextResponse.json({ error: 'You already own this course' }, { status: 400 })
    }

    const totalAmount = course.price
    let order;
    if (existingOrder) {
      order = await db.order.update({
        where: { id: existingOrder.id },
        data: {
          status: 'pending',
          totalAmount: totalAmount,
        },
        include: { course: true }
      });
    } else {
      const newOrderId = crypto.randomUUID();
      order = await db.order.create({
        data: {
          id: newOrderId,
          userId: session.user.id,
          courseId: resolvedCourseId,
          totalAmount: totalAmount,
          status: 'pending'
        },
        include: { course: true }
      });
    }
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
