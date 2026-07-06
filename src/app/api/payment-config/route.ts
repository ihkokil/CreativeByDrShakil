import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    const config = await db.query.paymentConfigs.findFirst({
      where: eq(schema.paymentConfigs.id, 'default'),
      columns: {
        provider: true,
        sendMoneyNumber: true,
        qrCodeUrl: true,
      },
    })

    if (!config) {
      return NextResponse.json({
        provider: 'bkash',
        sendMoneyNumber: '01700000000',
        qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        },
      })
    }

    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Failed to fetch payment configuration:', error);
    return NextResponse.json({
      provider: 'bkash',
      sendMoneyNumber: '01700000000',
      qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  }
}
