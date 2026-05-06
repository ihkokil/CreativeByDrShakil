import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth-server'
import prisma from '@/lib/prisma'
import { sendPaymentVerificationEmail } from '@/lib/payment-emails'
import { sendTelegramVerification } from '@/lib/telegram'

const paymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  amount: z.union([z.number(), z.string()]).optional(),
  sentAmount: z.union([z.number(), z.string()]).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = paymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: (parsed.error as any).errors[0].message }, { status: 400 })
    }

    const { orderId, phoneNumber, transactionId, amount, sentAmount } = parsed.data

    const paymentAmount = Number(sentAmount ?? amount)

    if (Number.isNaN(paymentAmount)) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const [payment] = await prisma.$transaction([
      prisma.payment.upsert({
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
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'pending' },
      }),
    ]);

    // Trigger notifications in the background
    (async () => {
      try {
        const fullOrder = await prisma.order.findUnique({
          where: { id: orderId },
          include: { 
            user: { select: { fullName: true } },
            course: { select: { title: true } }
          }
        });

        if (fullOrder) {
          const managers = await prisma.user.findMany({
            where: { canManagePayments: true },
            select: { email: true }
          });

          // Send emails
          for (const manager of managers) {
            await sendPaymentVerificationEmail({
              to: manager.email,
              studentName: fullOrder.user.fullName,
              courseTitle: fullOrder.course.title,
              amount: paymentAmount,
              transactionId,
              phoneNumber,
              orderId
            });
          }

          // Send Telegram notification
          await sendTelegramVerification({
            orderId,
            studentName: fullOrder.user.fullName,
            courseTitle: fullOrder.course.title,
            amount: paymentAmount,
            transactionId,
            phoneNumber
          });
        }
      } catch (err) {
        console.error('Failed to send payment notifications:', err);
      }
    })();

    return NextResponse.json({ payment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
