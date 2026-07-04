import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const config = await db.paymentConfig.findUnique({
      where: { id: 'default' },
      select: {
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
