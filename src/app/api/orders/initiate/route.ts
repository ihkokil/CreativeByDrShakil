import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import prisma from '@/lib/prisma'
import { COURSES } from '@/constants/courses'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { courseId, couponCode } = await request.json()
    let course = await prisma.course.findUnique({ where: { id: String(courseId) } })

    // Fallback for legacy constant-based course IDs (e.g. 1, 2, 3) used by UI cards.
    if (!course) {
      const constantCourse = COURSES.find((c) => String(c.id) === String(courseId))
      if (constantCourse) {
        const normalizedPrice =
          constantCourse.price.toLowerCase() === 'free'
            ? 0
            : Number(constantCourse.price.replace(/[^\d.]/g, '')) || 0

        const existingByTitle = await prisma.course.findFirst({
          where: { title: constantCourse.title },
        })

        course =
          existingByTitle ||
          (await prisma.course.create({
            data: {
              title: constantCourse.title,
              description: constantCourse.description || 'Course description coming soon.',
              price: normalizedPrice,
              instructor: constantCourse.mainInstructor.name,
              duration: constantCourse.duration,
            },
          }))
      }
    }

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    const resolvedCourseId = course.id

    const existingOrder = await prisma.order.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId: resolvedCourseId } }
    })
    if (existingOrder?.status === 'approved') {
      return NextResponse.json({ error: 'You already own this course' }, { status: 400 })
    }
    let discountAmount = 0
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } })
      if (!coupon?.isActive || (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses)) {
        return NextResponse.json({ error: 'Invalid coupon' }, { status: 400 })
      }
      discountAmount = coupon.discountAmount
    }
    const totalAmount = course.price - discountAmount
    const order = await prisma.order.create({
      data: { userId: session.user.id, courseId: resolvedCourseId, couponCode, totalAmount, discountAmount },
      include: { course: true }
    })
    return NextResponse.json({ order })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
