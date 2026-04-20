import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId } = await request.json()
    const course = await prisma.course.findUnique({ where: { id: String(courseId) } })

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const existingOrder = await prisma.order.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: resolvedCourseId } }
    })

    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS)

    if (existingOrder?.status === 'approved' && existingOrder.updatedAt >= oneYearAgo) {
      return NextResponse.json({ error: 'You already own this course' }, { status: 400 })
    }

    const totalAmount = course.price
    const order = existingOrder
      ? await prisma.order.update({
          where: { id: existingOrder.id },
          data: {
            status: 'pending',
            totalAmount,
          },
          include: { course: true },
        })
      : await prisma.order.create({
          data: { userId: session.user.id, courseId: resolvedCourseId, totalAmount },
          include: { course: true }
        })
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
