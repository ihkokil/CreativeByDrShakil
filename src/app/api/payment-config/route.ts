import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const config = await prisma.paymentConfig.findUnique({
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
      })
    }

    return NextResponse.json(config)
  } catch {
    return NextResponse.json({
      provider: 'bkash',
      sendMoneyNumber: '01700000000',
      qrCodeUrl: '/uploads/bkash-qr/bkash-qr.png',
    })
  }
}
