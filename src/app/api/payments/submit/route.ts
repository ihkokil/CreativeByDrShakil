import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth-server'
import { db } from '@/lib/db';
import { sendPaymentVerificationEmail } from '@/lib/payment-emails'
import { sendTelegramVerification } from '@/lib/telegram'

const paymentInputSchema = z.object({
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
    const parsed = paymentInputSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: (parsed.error as any).errors[0].message }, { status: 400 })
    }

    const { orderId, phoneNumber, transactionId, amount, sentAmount } = parsed.data

    const paymentAmount = Number(sentAmount ?? amount)

    if (Number.isNaN(paymentAmount)) {
      return NextResponse.json({ error: 'Invalid payment amount' }, { status: 400 })
    }

    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    await db.$transaction([
      db.payment.deleteMany({ where: { orderId } }),
      db.payment.create({
        data: {
          id: crypto.randomUUID(),
          orderId,
          phoneNumber,
          transactionId,
          amount: paymentAmount,
          status: 'pending',
        }
      }),
      db.order.update({
        where: { id: orderId },
        data: { status: 'pending' }
      })
    ]);

    const fullOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { fullName: true } },
        course: {
          select: { title: true },
          include: {
            teacher: {
              select: {
                email: true,
                telegramChatId: true,
              },
            },
          },
        },
      },
    });

    if (fullOrder) {
      const managers = await db.user.findMany({
        where: { canManagePayments: true },
        select: { email: true, telegramChatId: true },
      });

      const recipientEmails = new Set<string>();
      const additionalChatIds = new Set<string>();

      for (const manager of managers) {
        if (manager.email) recipientEmails.add(manager.email);
        if (manager.telegramChatId) additionalChatIds.add(manager.telegramChatId);
      }

      if (fullOrder.course.teacher?.email) {
        recipientEmails.add(fullOrder.course.teacher.email);
      }
      if (fullOrder.course.teacher?.telegramChatId) {
        additionalChatIds.add(fullOrder.course.teacher.telegramChatId);
      }

      // 1. Send Emails
      await Promise.allSettled(
        Array.from(recipientEmails).map((email) =>
          sendPaymentVerificationEmail({
            to: email,
            studentName: fullOrder.user.fullName,
            courseTitle: fullOrder.course.title,
            amount: paymentAmount,
            transactionId,
            phoneNumber,
            orderId,
          })
        )
      );

      // 2. Send Telegram Notifications
      await sendTelegramVerification({
        orderId,
        studentName: fullOrder.user.fullName,
        courseTitle: fullOrder.course.title,
        amount: paymentAmount,
        transactionId,
        phoneNumber,
        additionalChatIds: Array.from(additionalChatIds),
      });
    }

    const newPayment = await db.payment.findFirst({ where: { orderId } });

    return NextResponse.json({ payment: newPayment })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
