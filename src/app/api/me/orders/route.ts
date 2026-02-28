import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getAuthPayload } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await prisma.order.findMany({
      where: { userId: payload.sub },
      include: { course: true, payment: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(orders)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
