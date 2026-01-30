import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-server'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orderId, phoneNumber, transactionId, amount, sentAmount } = await request.json()

    const paymentAmount = Number(sentAmount ?? amount)

    if (!orderId || !phoneNumber || !transactionId || Number.isNaN(paymentAmount)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const payment = await prisma.payment.upsert({
      where: { orderId },
      update: {
        phoneNumber,
        transactionId,
        amount: paymentAmount,
        status: 'pending',
      },
      create: {
        orderId,
        phoneNumber,
        transactionId,
        amount: paymentAmount,
        status: 'pending',
      },
    })

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'pending' },
    })

    return NextResponse.json({ payment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
