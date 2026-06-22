import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, payment as paymentSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { updateTelegramVerificationMessage } from '@/lib/telegram';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Telegram sends callback_query when an inline button is pressed
    if (body.callback_query) {
      const { id, data, message, from } = body.callback_query;
      const [prefix, orderId, action] = (data || '').split(':');

      if (prefix === 'payment_verify' && orderId && action) {
        const order = await db.query.order.findFirst({
          where: (o, { eq }) => eq(o.id, orderId),
          with: { payments: true },
        });

        if (!order) {
          return NextResponse.json({ ok: true }); // Acknowledge to Telegram
        }

        if (order.status === 'pending') {
          const nextStatus = action === 'approve' ? 'approved' : 'rejected';

          await db.transaction(async (tx) => {
            await tx.update(orderSchema).set({ status: nextStatus }).where(eq(orderSchema.id, orderId));
            if (order.payments?.length) {
              await tx.update(paymentSchema).set({
                  status: nextStatus,
                  approvedAt: action === 'approve' ? new Date().toISOString() : null,
              }).where(eq(paymentSchema.orderId, orderId));
            }
          });

          // Update the Telegram message to show it's handled
          await updateTelegramVerificationMessage({
            chatId: message.chat.id,
            messageId: message.message_id,
            decision: action as 'approve' | 'reject',
            adminName: from.first_name || 'Admin',
          });
        } else {
          // If already processed, just update the UI to remove buttons
          await updateTelegramVerificationMessage({
            chatId: message.chat.id,
            messageId: message.message_id,
            decision: order.status === 'approved' ? 'approve' : 'reject',
            adminName: 'System (Already processed)',
          });
        }
        const statusText = order?.status === 'pending' 
          ? `Payment ${action === 'approve' ? 'approved' : 'rejected'} successfully.`
          : `This payment was already ${order?.status}.`;

        // Answer callback query to stop loading spinner on Telegram
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.replace(/"/g, '');
        const answerUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: id,
            text: statusText,
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
