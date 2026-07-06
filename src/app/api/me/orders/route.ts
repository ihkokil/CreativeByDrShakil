import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.userId, payload.sub),
      with: { course: true, payments: true },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    })

    return NextResponse.json(orders)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
