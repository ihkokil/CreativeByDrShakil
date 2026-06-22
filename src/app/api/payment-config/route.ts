import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const config = await db.query.paymentConfig.findFirst({
      where: (p, { eq }) => eq(p.id, 'default'),
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
      })
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Failed to fetch payment configuration:', error);
    return NextResponse.json({
      provider: 'bkash',
      sendMoneyNumber: '01700000000',
      qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
    })
  }
}
