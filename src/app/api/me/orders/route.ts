import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth'

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orders = await db.query.orders.findMany({
      where: eq(schema.orders.userId, payload.sub),
      with: { course: true, payment: true },
      orderBy: [desc(schema.orders.createdAt)],
    })

    return NextResponse.json(orders)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
