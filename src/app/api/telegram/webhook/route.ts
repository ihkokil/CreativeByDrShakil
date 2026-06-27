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
import { updateTelegramVerificationMessage, compressUuid, decompressUuid } from '@/lib/telegram';

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

    // Helper: send a message and log errors
    async function sendMsg(chatId: string | number, text: string, extra?: Record<string, unknown>) {
      const res = await fetch(sendMsgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[Telegram] sendMessage failed:', err);
      }
      return res;
    }

    // Helper: answer callback query (stops loading spinner)
    async function answerCb(callbackQueryId: string, text?: string) {
      await fetch(answerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
      });
    }

    // ─── CALLBACK QUERY HANDLER ───
    if (body.callback_query) {
      const { id, data, message, from } = body.callback_query;
      const callbackChatId = message.chat.id;
      const sessionKey = String(callbackChatId);

      // Parse prefix:value from callback_data
      const colonIdx = (data || '').indexOf(':');
      const prefix = colonIdx >= 0 ? data.slice(0, colonIdx) : data;
      const value = colonIdx >= 0 ? data.slice(colonIdx + 1) : '';

      // Answer callback query immediately to stop the Telegram loading spinner.
      try {
        await answerCb(id);
      } catch (err) {
        console.error('[Telegram Webhook] Failed to answer callback query early:', err);
      }

      // ── Payment verification ──
      if (prefix === 'payment_verify') {
        const [orderId, action] = value.split(':');
        const order = await db.query.order.findFirst({
          where: (o, { eq }) => eq(o.id, orderId),
          with: { payments: true },
        });

        if (!order) {
          return NextResponse.json({ ok: true });
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

          await updateTelegramVerificationMessage({
            chatId: message.chat.id,
            messageId: message.message_id,
            decision: action as 'approve' | 'reject',
            adminName: from.first_name || 'Admin',
          });
        } else {
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
      }

      // ── Step 1: Enroll — show course list ──
      // callback_data: "en:{compressedUserId}" (max ~28 bytes ✓)
      else if (prefix === 'en') {
        const compressedUserId = value;

        const courses = await db.query.course.findMany({
          where: (c, { eq }) => eq(c.status, 'published'),
          columns: { id: true, title: true }
        });

        if (courses.length === 0) {
          await sendMsg(callbackChatId, '❌ No available courses found in the system.');
          return NextResponse.json({ ok: true });
        }

        // callback_data: "sc:{compressedUserId}:{courseId}" (max ~54 bytes ✓)
        const inlineKeyboard = courses.map(c => [
          { text: c.title, callback_data: `sc:${compressedUserId}:${c.id}` }
        ]);

        await sendMsg(callbackChatId, '📚 <b>Select a course to enroll the student:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 2: Enroll — perform enrollment ──
      // callback_data: "sc:{compressedUserId}:{courseId}" (max ~54 bytes ✓)
      else if (prefix === 'sc') {
        const parts = value.split(':');
        const compressedUserId = parts[0];
        const courseId = parts[1];

        if (!compressedUserId || !courseId) {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        const userId = decompressUuid(compressedUserId);

        const student = await db.query.user.findFirst({
          where: (u, { eq, and }) => and(eq(u.id, userId), eq(u.role, 'student')),
          columns: { fullName: true, email: true }
        });

        if (!student) {
          await sendMsg(callbackChatId, '❌ Student not found.');
          return NextResponse.json({ ok: true });
        }

        const course = await db.query.course.findFirst({
          where: (c, { eq }) => eq(c.id, courseId),
          columns: { id: true, title: true }
        });

        if (!course) {
          await sendMsg(callbackChatId, '❌ Course not found.');
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
          await sendMsg(callbackChatId, `⚠️ Student is already enrolled in course: <b>${course.title}</b>`);
        } else {
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

          console.log(`[AUDIT] Student ${student.fullName} (${userId}) enrolled in course ${course.title} (${courseId}) via Telegram Bot by ${from.first_name || 'Admin'}`);

          await sendMsg(callbackChatId, `✅ Student successfully enrolled in:\n📚 <b>${course.title}</b>`);
        }
      }

      // ── Step 1: Availability — show enrolled courses ──
      // callback_data: "av:{compressedUserId}" (max ~28 bytes ✓)
      else if (prefix === 'av') {
        const compressedUserId = value;
        const userId = decompressUuid(compressedUserId);

        const enrolledOrders = await db.query.order.findMany({
          where: (o, { eq, and }) => and(eq(o.userId, userId), eq(o.status, 'approved')),
          with: { course: true }
        });

        if (enrolledOrders.length === 0) {
          await sendMsg(callbackChatId, '❌ Student is not enrolled in any courses.');
          return NextResponse.json({ ok: true });
        }

        // callback_data: "ac:{compressedUserId}:{courseId}" (max ~54 bytes ✓)
        const inlineKeyboard = enrolledOrders.map(o => [
          { text: o.course.title, callback_data: `ac:${compressedUserId}:${o.courseId}` }
        ]);

        await sendMsg(callbackChatId, '⚙️ <b>Select course to modify:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 2: Availability — select type ──
      // callback_data: "ac:{compressedUserId}:{courseId}" (max ~54 bytes ✓)
      else if (prefix === 'ac') {
        const parts = value.split(':');
        const compressedUserId = parts[0];
        const courseId = parts[1];

        if (!compressedUserId || !courseId) {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        // callback_data: "at:cd:{compressedUserId}:{courseId}" (max ~57 bytes ✓)
        const inlineKeyboard = [
          [{ text: 'Custom Date', callback_data: `at:cd:${compressedUserId}:${courseId}` }]
        ];

        await sendMsg(callbackChatId, '<b>Select availability type:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 3: Availability — prompt for dates ──
      // callback_data: "at:cd:{compressedUserId}:{courseId}" (max ~57 bytes ✓)
      else if (prefix === 'at') {
        const parts = value.split(':');
        const actionType = parts[0];
        const compressedUserId = parts[1];
        const courseId = parts[2];

        if (!compressedUserId || !courseId || actionType !== 'cd') {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        const userId = decompressUuid(compressedUserId);

        // Send ForceReply message to get Start Date
        // Embed userId and courseId in the message text for the reply handler
        await sendMsg(callbackChatId,
          `Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
          { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
        );
      }
    }

    // ─── FORCE REPLY HANDLER (user responds to bot's ForceReply) ───
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
          await sendMsg(messageChatId,
            `❌ Invalid format. Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
          return NextResponse.json({ ok: true });
        }

        const start = new Date(responseText);
        if (Number.isNaN(start.getTime())) {
          await sendMsg(messageChatId,
            `❌ Invalid date. Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
          return NextResponse.json({ ok: true });
        }

        // Ask for End Date
        await sendMsg(messageChatId,
          `Please enter end date (YYYY-MM-DD) or reply 'none' for no expiry:\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${responseText}]`,
          { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
        );
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
            await sendMsg(messageChatId,
              `❌ Invalid format. Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
              { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
            );
            return NextResponse.json({ ok: true });
          }

          end = new Date(responseText);
          if (Number.isNaN(end.getTime())) {
            await sendMsg(messageChatId,
              `❌ Invalid date. Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
              { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
            );
            return NextResponse.json({ ok: true });
          }

          if (end < start) {
            await sendMsg(messageChatId,
              `❌ End date cannot be earlier than start date (${startDateStr}). Please enter end date (YYYY-MM-DD) or reply 'none':\n\n[Session: enter_end_date]\n[User: ${userId}]\n[Course: ${courseId}]\n[Start: ${startDateStr}]`,
              { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
            );
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

        await sendMsg(messageChatId, `✅ <b>Module availability updated successfully.</b>\n\n📚 <b>Course:</b> ${course?.title || 'Unknown Course'}\n📅 <b>Start Date:</b> ${startDateStr}\n📅 <b>End Date:</b> ${endDisplay}`);
      }
    }

    // ─── TEXT COMMAND HANDLER ───
    // Handles /enroll, /availability, /student, /help commands
    if (body.message && body.message.text && !body.message.reply_to_message) {
      const text = (body.message.text || '').trim();
      const messageChatId = body.message.chat.id;
      const sessionKey = String(messageChatId);

      // /help — show available commands
      if (text === '/help' || text === '/start') {
        await sendMsg(messageChatId, [
          '<b>📋 Available Commands:</b>',
          '',
          '<code>/student email@example.com</code>',
          '→ Look up a student and show action buttons',
          '',
          '<code>/enroll email@example.com</code>',
          '→ Enroll a student into a course',
          '',
          '<code>/availability email@example.com</code>',
          '→ Change a student\'s module availability',
          '',
          '<code>/help</code>',
          '→ Show this help message',
        ].join('\n'));
        return NextResponse.json({ ok: true });
      }

      // /student <email> — look up student and show action buttons
      if (text.startsWith('/student')) {
        const email = text.replace('/student', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/student email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.email, email),
          columns: { id: true, fullName: true, email: true, role: true, phone: true, createdAt: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        // Fetch enrolled courses
        const enrollments = await db.query.order.findMany({
          where: (o, { eq, and }) => and(eq(o.userId, student.id), eq(o.status, 'approved')),
          with: { course: { columns: { title: true } } }
        });

        const courseList = enrollments.length > 0
          ? enrollments.map(e => `  • ${e.course.title}`).join('\n')
          : '  <i>None</i>';

        const message = [
          '<b>👤 Student Info</b>',
          '',
          `<b>Name:</b> ${student.fullName}`,
          `<b>Email:</b> ${student.email}`,
          `<b>Phone:</b> ${student.phone || 'N/A'}`,
          `<b>Role:</b> ${student.role}`,
          `<b>ID:</b> <code>${student.id}</code>`,
          '',
          `<b>📚 Enrolled Courses (${enrollments.length}):</b>`,
          courseList,
          '',
          'Select an action below:'
        ].join('\n');

        const compressedUserId = compressUuid(student.id);
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📚 Enroll in Course', callback_data: `en:${compressedUserId}` },
              { text: '⚙️ Change Availability', callback_data: `av:${compressedUserId}` }
            ]
          ]
        };

        await sendMsg(messageChatId, message, { reply_markup: replyMarkup });
        return NextResponse.json({ ok: true });
      }

      // /enroll <email> — start enrollment flow
      if (text.startsWith('/enroll')) {
        const email = text.replace('/enroll', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/enroll email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.email, email),
          columns: { id: true, fullName: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        const courses = await db.query.course.findMany({
          where: (c, { eq }) => eq(c.status, 'published'),
          columns: { id: true, title: true }
        });

        if (courses.length === 0) {
          await sendMsg(messageChatId, '❌ No published courses found in the system.');
          return NextResponse.json({ ok: true });
        }

        const compressedUserId = compressUuid(student.id);
        const inlineKeyboard = courses.map(c => [
          { text: c.title, callback_data: `sc:${compressedUserId}:${c.id}` }
        ]);

        await sendMsg(messageChatId,
          `📚 <b>Select a course to enroll ${student.fullName}:</b>`,
          { reply_markup: { inline_keyboard: inlineKeyboard } }
        );
        return NextResponse.json({ ok: true });
      }

      // /availability <email> — start availability change flow
      if (text.startsWith('/availability')) {
        const email = text.replace('/availability', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/availability email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.email, email),
          columns: { id: true, fullName: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        const enrolledOrders = await db.query.order.findMany({
          where: (o, { eq, and }) => and(eq(o.userId, student.id), eq(o.status, 'approved')),
          with: { course: true }
        });

        if (enrolledOrders.length === 0) {
          await sendMsg(messageChatId, `❌ <b>${student.fullName}</b> is not enrolled in any courses.`);
          return NextResponse.json({ ok: true });
        }

        const compressedUserId = compressUuid(student.id);
        const inlineKeyboard = enrolledOrders.map(o => [
          { text: o.course.title, callback_data: `ac:${compressedUserId}:${o.courseId}` }
        ]);

        await sendMsg(messageChatId,
          `⚙️ <b>Select course to modify availability for ${student.fullName}:</b>`,
          { reply_markup: { inline_keyboard: inlineKeyboard } }
        );
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Telegram webhook error:', error);
    // Return 200 OK so Telegram does not retry the failed webhook
    return NextResponse.json({ ok: true, error: error.message });
  }
}
