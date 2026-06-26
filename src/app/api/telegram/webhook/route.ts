import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  order as orderSchema,
  payment as paymentSchema,
  course as courseSchema,
  user as userSchema,
  studentModuleAvailability as smaSchema
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { updateTelegramVerificationMessage } from '@/lib/telegram';

function getTelegramChatIds() {
  const envChatId = process.env.TELEGRAM_CHAT_ID?.replace(/"/g, '') || '';
  return envChatId.split(',').map(id => id.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check authorization: sender chat_id or user_id must be in TELEGRAM_CHAT_ID list
    const envChatIds = getTelegramChatIds();
    const fromId = body.callback_query?.from?.id || body.message?.from?.id;
    const chatId = body.callback_query?.message?.chat?.id || body.message?.chat?.id;

    const isAuthorized = envChatIds.includes(String(fromId)) || envChatIds.includes(String(chatId));
    if (!isAuthorized) {
      console.warn('[Telegram Webhook] Unauthorized request:', { fromId, chatId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.replace(/"/g, '');
    const sendMsgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const answerUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;

    // Telegram sends callback_query when an inline button is pressed
    if (body.callback_query) {
      const { id, data, message, from } = body.callback_query;
      const callbackChatId = message.chat.id;

      const [prefix] = (data || '').split(':');

      if (prefix === 'payment_verify') {
        const [, orderId, action] = data.split(':');
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
        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: id,
            text: statusText,
          }),
        });
      }

      else if (prefix === 'tg_enroll') {
        const [, userId] = data.split(':');
        // Fetch all available courses
        const courses = await db.query.course.findMany({
          where: (c, { eq }) => eq(c.status, 'published'),
          columns: { id: true, title: true }
        });

        if (courses.length === 0) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: '❌ No available courses found in the system.',
            })
          });
          return NextResponse.json({ ok: true });
        }

        // Send inline buttons for courses
        const inlineKeyboard = courses.map(c => [
          { text: c.title, callback_data: `tg_do_enroll:${userId}:${c.id}` }
        ]);

        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: callbackChatId,
            text: '📚 <b>Select a course to enroll the student:</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
          })
        });

        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      }

      else if (prefix === 'tg_do_enroll') {
        const [, userId, courseId] = data.split(':');

        const student = await db.query.user.findFirst({
          where: (u, { eq, and }) => and(eq(u.id, userId), eq(u.role, 'student')),
          columns: { fullName: true, email: true }
        });

        if (!student) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: '❌ Student not found.',
            })
          });
          return NextResponse.json({ ok: true });
        }

        const course = await db.query.course.findFirst({
          where: (c, { eq }) => eq(c.id, courseId),
          columns: { id: true, title: true }
        });

        if (!course) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: '❌ Course not found.',
            })
          });
          return NextResponse.json({ ok: true });
        }

        // Prevent duplicate enrollment
        const existingOrder = await db.query.order.findFirst({
          where: (o, { eq, and }) => and(
            eq(o.userId, userId),
            eq(o.courseId, courseId),
            eq(o.status, 'approved')
          )
        });

        if (existingOrder) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: `⚠️ Student is already enrolled in course: <b>${course.title}</b>`,
              parse_mode: 'HTML'
            })
          });
        } else {
          // Perform enrollment
          await db.transaction(async (tx) => {
            const enrollOrder = await tx.query.order.findFirst({
              where: (o: any, { eq, and }: any) => and(eq(o.userId, userId), eq(o.courseId, courseId))
            });

            if (enrollOrder) {
              await tx.update(orderSchema)
                .set({
                  status: 'approved',
                  enrolledAt: new Date().toISOString(),
                  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(orderSchema.id, enrollOrder.id));
            } else {
              await tx.insert(orderSchema).values({
                id: crypto.randomUUID(),
                userId,
                courseId,
                status: 'approved',
                totalAmount: 0,
                enrolledAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              });
            }
          });

          // Log action in system audit logs
          console.log(`[AUDIT] Student ${student.fullName} (${userId}) enrolled in course ${course.title} (${courseId}) via Telegram Bot by ${from.first_name || 'Admin'}`);

          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: `✅ Student successfully enrolled in:\n📚 <b>${course.title}</b>`,
              parse_mode: 'HTML'
            })
          });
        }

        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      }

      else if (prefix === 'tg_availability') {
        const [, userId] = data.split(':');

        const enrolledOrders = await db.query.order.findMany({
          where: (o, { eq, and }) => and(eq(o.userId, userId), eq(o.status, 'approved')),
          with: { course: true }
        });

        if (enrolledOrders.length === 0) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: '❌ Student is not enrolled in any courses.',
            })
          });
          return NextResponse.json({ ok: true });
        }

        const inlineKeyboard = enrolledOrders.map(o => [
          { text: o.course.title, callback_data: `tg_avail_course:${userId}:${o.courseId}` }
        ]);

        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: callbackChatId,
            text: '⚙️ <b>Select course to modify:</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
          })
        });

        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      }

      else if (prefix === 'tg_avail_course') {
        const [, userId, courseId] = data.split(':');

        const inlineKeyboard = [
          [
            { text: 'Custom Date', callback_data: `tg_avail_type:${userId}:${courseId}:custom_date` }
          ]
        ];

        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: callbackChatId,
            text: '<b>Select availability type:</b>',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
          })
        });

        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      }

      else if (prefix === 'tg_avail_type') {
        const [, userId, courseId, availType] = data.split(':');

        if (availType === 'custom_date') {
          // Send ForceReply message to get Start Date
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: callbackChatId,
              text: `Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
              reply_markup: { force_reply: true, selective: true }
            })
          });
        }

        await fetch(answerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id })
        });
      }
    }

    // Process user responses using ForceReply
    if (body.message && body.message.reply_to_message) {
      const replyToText = body.message.reply_to_message.text || '';
      const responseText = (body.message.text || '').trim();
      const messageChatId = body.message.chat.id;
      const from = body.message.from;

      if (replyToText.includes('[Session: enter_start_date]')) {
        const userMatch = replyToText.match(/\[User:\s*([^\]]+)\]/);
        const courseMatch = replyToText.match(/\[Course:\s*([^\]]+)\]/);
        const userId = userMatch ? userMatch[1].trim() : '';
        const courseId = courseMatch ? courseMatch[1].trim() : '';

        // Validate date YYYY-MM-DD
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(responseText)) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: messageChatId,
              text: `❌ Invalid format. Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
              reply_markup: { force_reply: true, selective: true }
            })
          });
          return NextResponse.json({ ok: true });
        }

        const start = new Date(responseText);
        if (Number.isNaN(start.getTime())) {
          await fetch(sendMsgUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: messageChatId,
              text: `❌ Invalid date. Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
              reply_markup: { force_reply: true, selective: true }
            })
          });
          return NextResponse.json({ ok: true });
        }

        // Ask for End Date
        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageChatId,
            text: `Please enter end date (YYYY-MM-DD) or reply 'none' for no expiry:\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${responseText}]`,
            reply_markup: { force_reply: true, selective: true }
          })
        });
      }

      else if (replyToText.includes('[Session: enter_end_date]')) {
        const userMatch = replyToText.match(/\[User:\s*([^\]]+)\]/);
        const courseMatch = replyToText.match(/\[Course:\s*([^\]]+)\]/);
        const startMatch = replyToText.match(/\[Start:\s*([^\]]+)\]/);
        const userId = userMatch ? userMatch[1].trim() : '';
        const courseId = courseMatch ? courseMatch[1].trim() : '';
        const startDateStr = startMatch ? startMatch[1].trim() : '';

        const start = new Date(startDateStr);
        let end: Date | null = null;
        const isNone = responseText.toLowerCase() === 'none';

        if (!isNone) {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(responseText)) {
            await fetch(sendMsgUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: messageChatId,
                text: `❌ Invalid format. Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
                reply_markup: { force_reply: true, selective: true }
              })
            });
            return NextResponse.json({ ok: true });
          }

          end = new Date(responseText);
          if (Number.isNaN(end.getTime())) {
            await fetch(sendMsgUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: messageChatId,
                text: `❌ Invalid date. Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
                reply_markup: { force_reply: true, selective: true }
              })
            });
            return NextResponse.json({ ok: true });
          }

          if (end < start) {
            await fetch(sendMsgUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: messageChatId,
                text: `❌ End date cannot be earlier than start date (${startDateStr}). Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
                reply_markup: { force_reply: true, selective: true }
              })
            });
            return NextResponse.json({ ok: true });
          }
        }

        const course = await db.query.course.findFirst({
          where: (c, { eq }) => eq(c.id, courseId),
          columns: { title: true }
        });

        // Update DB
        await db.update(orderSchema)
          .set({
            enrolledAt: start.toISOString(),
            expiresAt: end ? end.toISOString() : null,
            updatedAt: new Date().toISOString()
          })
          .where(and(
            eq(orderSchema.courseId, courseId),
            eq(orderSchema.userId, userId)
          ));

        // Clear custom overrides to follow the general course schedule relative to start date
        await db.delete(smaSchema).where(and(
          eq(smaSchema.courseId, courseId),
          eq(smaSchema.userId, userId)
        ));

        // Log action in system audit logs
        console.log(`[AUDIT] Student ${userId} module availability updated for course ${courseId} via Telegram Bot (Start: ${startDateStr}, End: ${end ? responseText : 'none'}) by ${from?.first_name || 'Admin'}`);

        const endDisplay = end ? responseText : 'No Expiry';

        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: messageChatId,
            text: `✅ <b>Module availability updated successfully.</b>\n\n📚 <b>Course:</b> ${course?.title || 'Unknown Course'}\n📅 <b>Start Date:</b> ${startDateStr}\n📅 <b>End Date:</b> ${endDisplay}`,
            parse_mode: 'HTML'
          })
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
