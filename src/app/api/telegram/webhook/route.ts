import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { updateTelegramVerificationMessage, compressUuid, decompressUuid } from '@/lib/telegram';
import {
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { randomUUID } from 'crypto';
function getTelegramChatIds() {
  const envChatId = process.env.TELEGRAM_CHAT_ID?.replace(/"/g, '') || '';
  return envChatId.split(',').map(id => id.trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  let body: any = null;
  try {
    body = await request.json();

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
        const orderRecord = await db.query.orders.findFirst({
          where: eq(schema.orders.id, orderId),
        });
        const payment = orderRecord
          ? await db.query.payments.findFirst({ where: eq(schema.payments.orderId, orderRecord.id) })
          : null;
        const order = orderRecord ? { ...orderRecord, payment } : null;

        if (!order) {
          return NextResponse.json({ ok: true });
        }

        if (order.status === 'pending') {
          const nextStatus = action === 'approve' ? 'approved' : 'rejected';

          await db.transaction(async (tx) => {
            await tx.update(schema.orders)
              .set({ status: nextStatus })
              .where(eq(schema.orders.id, orderId));

            if (order.payment) {
              await tx.update(schema.payments)
                .set({
                  status: nextStatus,
                  approvedAt: action === 'approve' ? new Date() : null,
                })
                .where(eq(schema.payments.orderId, orderId));
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
      else if (prefix === 'en') {
        const compressedUserId = value;

        const courses = await db.query.courses.findMany({
          where: eq(schema.courses.status, 'published'),
          columns: { id: true, title: true }
        });

        if (courses.length === 0) {
          await sendMsg(callbackChatId, '❌ No available courses found in the system.');
          return NextResponse.json({ ok: true });
        }

        const inlineKeyboard = courses.map(c => [
          { text: c.title, callback_data: `sc:${compressedUserId}:${c.id}` }
        ]);

        await sendMsg(callbackChatId, '📚 <b>Select a course to enroll the student:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 2: Enroll — perform enrollment ──
      else if (prefix === 'sc') {
        const parts = value.split(':');
        const compressedUserId = parts[0];
        const courseId = parts[1];

        if (!compressedUserId || !courseId) {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        const userId = decompressUuid(compressedUserId);

        const student = await db.query.users.findFirst({
          where: and(eq(schema.users.id, userId), eq(schema.users.role, 'student')),
          columns: { fullName: true, email: true }
        });

        if (!student) {
          await sendMsg(callbackChatId, '❌ Student not found.');
          return NextResponse.json({ ok: true });
        }

        const course = await db.query.courses.findFirst({
          where: eq(schema.courses.id, courseId),
          columns: { id: true, title: true }
        });

        if (!course) {
          await sendMsg(callbackChatId, '❌ Course not found.');
          return NextResponse.json({ ok: true });
        }

        // Prevent duplicate enrollment
        const existingOrder = await db.query.orders.findFirst({
          where: and(
            eq(schema.orders.userId, userId),
            eq(schema.orders.courseId, courseId),
            eq(schema.orders.status, 'approved')
          )
        });

        if (existingOrder) {
          await sendMsg(callbackChatId, `⚠️ Student is already enrolled in course: <b>${course.title}</b>`);
        } else {
          const enrollOrder = await db.query.orders.findFirst({
            where: and(eq(schema.orders.userId, userId), eq(schema.orders.courseId, courseId))
          });

          if (enrollOrder) {
            await db.update(schema.orders)
              .set({
                status: 'approved',
                enrolledAt: new Date(),
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                updatedAt: new Date(),
              })
              .where(eq(schema.orders.id, enrollOrder.id));
          } else {
            await db.insert(schema.orders).values({
              id: crypto.randomUUID(),
              userId,
              courseId,
              status: 'approved',
              totalAmount: 0,
              enrolledAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          console.log(`[AUDIT] Student ${student.fullName} (${userId}) enrolled in course ${course.title} (${courseId}) via Telegram Bot by ${from.first_name || 'Admin'}`);

          await sendMsg(callbackChatId, `✅ Student successfully enrolled in:\n📚 <b>${course.title}</b>`);
        }
      }

      // ── Step 1: Availability — show enrolled courses ──
      else if (prefix === 'av') {
        const compressedUserId = value;
        const userId = decompressUuid(compressedUserId);

        const rawEnrolledOrders = await db.query.orders.findMany({
          where: and(eq(schema.orders.userId, userId), eq(schema.orders.status, 'approved')),
        });

        const courseIds = [...new Set(rawEnrolledOrders.map(o => o.courseId).filter(Boolean))] as string[];
        const courses = courseIds.length > 0
          ? await db.query.courses.findMany({ where: inArray(schema.courses.id, courseIds) })
          : [];
        const courseMap = new Map(courses.map(c => [c.id, c]));

        const enrolledOrders = rawEnrolledOrders.map((o) => ({
          ...o,
          course: courseMap.get(o.courseId) || null,
        })).filter(o => o.course !== null) as any[];

        if (enrolledOrders.length === 0) {
          await sendMsg(callbackChatId, '❌ Student is not enrolled in any courses.');
          return NextResponse.json({ ok: true });
        }

        const inlineKeyboard = enrolledOrders.map(o => [
          { text: o.course.title, callback_data: `ac:${compressedUserId}:${o.courseId}` }
        ]);

        await sendMsg(callbackChatId, '⚙️ <b>Select course to modify:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 2: Availability — select type ──
      else if (prefix === 'ac') {
        const parts = value.split(':');
        const compressedUserId = parts[0];
        const courseId = parts[1];

        if (!compressedUserId || !courseId) {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        const inlineKeyboard = [
          [{ text: '🗓 Change enrollment date', callback_data: `at:cd:${compressedUserId}:${courseId}` }],
          [{ text: '🔓 Unlock all modules', callback_data: `at:ua:${compressedUserId}:${courseId}` }],
          [{ text: '🏁 Start from today (Default)', callback_data: `at:st:${compressedUserId}:${courseId}` }],
          [{ text: '📅 Select Week Days', callback_data: `at:wd:${compressedUserId}:${courseId}` }],
          [{ text: '⏳ Set Day Interval', callback_data: `at:ci:${compressedUserId}:${courseId}` }]
        ];

        await sendMsg(callbackChatId, '<b>Select availability type:</b>', {
          reply_markup: { inline_keyboard: inlineKeyboard }
        });
      }

      // ── Step 3: Availability — prompt for dates ──
      else if (prefix === 'at') {
        const parts = value.split(':');
        const actionType = parts[0];
        const compressedUserId = parts[1];
        const courseId = parts[2];

        if (!compressedUserId || !courseId || !['cd', 'ua', 'st', 'wd', 'ci'].includes(actionType)) {
          await sendMsg(callbackChatId, '❌ Invalid callback data.');
          return NextResponse.json({ ok: true });
        }

        const userId = decompressUuid(compressedUserId);
        const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, courseId) });
        if (!course) {
          await sendMsg(callbackChatId, '❌ Course not found.');
          return NextResponse.json({ ok: true });
        }

        if (actionType === 'cd') {
          await sendMsg(callbackChatId,
            `Please enter start date (YYYY-MM-DD):\n\n[Session: enter_start_date]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
        } else if (actionType === 'wd') {
          await sendMsg(callbackChatId,
            `Please enter comma-separated days of the week (e.g. Mon, Wed, Fri):\n\n[Session: enter_week_days]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
        } else if (actionType === 'ci') {
          await sendMsg(callbackChatId,
            `Please enter the day interval as a number (e.g. 7):\n\n[Session: enter_interval]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
        } else if (actionType === 'ua') {
          const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
          const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
          const curriculum = ensureGroupInheritance(populatedCurriculum);
          
          const allNodeIds: string[] = [];
          const collect = (nodes: any[]) => {
            nodes.forEach(n => {
              allNodeIds.push(n.id);
              if (n.children?.length) collect(n.children);
            });
          };
          collect(curriculum);

          const dataToInsert = allNodeIds.map(nodeId => ({
            id: randomUUID(),
            courseId,
            userId,
            lessonNodeId: nodeId,
            availabilityMode: 'available',
            availableAt: null,
          }));

          await db.transaction(async (tx) => {
            await tx.delete(schema.studentModuleAvailability).where(and(eq(schema.studentModuleAvailability.courseId, courseId), eq(schema.studentModuleAvailability.userId, userId)));
            if (dataToInsert.length > 0) {
              await tx.insert(schema.studentModuleAvailability).values(dataToInsert as any);
            }
          });
          await sendMsg(callbackChatId, `✅ <b>All modules unlocked successfully</b>\n\n📚 <b>Course:</b> ${course.title}`);
        } else if (actionType === 'st') {
          const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
          const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
          const curriculum = ensureGroupInheritance(populatedCurriculum);
          
          const groups = collectSecondChildGroups(curriculum);
          const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

          const computedDaysOfWeek = typeof course.releaseDaysOfWeek === 'string' ? JSON.parse(course.releaseDaysOfWeek) : course.releaseDaysOfWeek;
          const targetDates = computeReleaseGroupDates(groups, {
            releaseMode: course.releaseMode as any,
            releaseStartAt: new Date(),
            releaseIntervalDays: course.releaseIntervalDays || 7,
            releaseGroupsPerWeek: course.releaseGroupsPerWeek,
            releaseDaysOfWeek: computedDaysOfWeek,
            releaseGroupDates: {},
          });

          const dataToInsert = Object.entries(targetDates).map(([groupId, dateStr]) => ({
            id: randomUUID(),
            courseId,
            userId,
            lessonNodeId: groupIdToNodeId.get(groupId)!,
            availabilityMode: 'available',
            availableAt: dateStr ? new Date(dateStr) : null,
          }));

          await db.transaction(async (tx) => {
            await tx.delete(schema.studentModuleAvailability).where(and(eq(schema.studentModuleAvailability.courseId, courseId), eq(schema.studentModuleAvailability.userId, userId)));
            if (dataToInsert.length > 0) {
              await tx.insert(schema.studentModuleAvailability).values(dataToInsert as any);
            }
          });
          await sendMsg(callbackChatId, `✅ <b>Module availability set starting from today</b>\n\n📚 <b>Course:</b> ${course.title}`);
        }
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

        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);

        const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, courseId), columns: { title: true } });

        await db.transaction(async (tx) => {
          await tx.update(schema.orders)
            .set({ enrolledAt: start, expiresAt: end, updatedAt: new Date() })
            .where(and(eq(schema.orders.courseId, courseId), eq(schema.orders.userId, userId)));
            
          await tx.delete(schema.studentModuleAvailability).where(and(eq(schema.studentModuleAvailability.courseId, courseId), eq(schema.studentModuleAvailability.userId, userId)));
        });

        console.log(`[AUDIT] Student ${userId} enrollment date updated to ${responseText} via Telegram Bot by ${from?.first_name || 'Admin'}`);
        await sendMsg(messageChatId, `✅ <b>Enrollment date updated successfully.</b>\n\n📚 <b>Course:</b> ${course?.title || 'Unknown Course'}\n📅 <b>New Start Date:</b> ${responseText}\n⏳ <b>Calculated Expiry:</b> ${end.toISOString().split('T')[0]}`);
      }

      else if (replyToText.includes('[Session: enter_week_days]')) {
        const userMatch = replyToText.match(/\[User:\s*([^\]]+)\]/);
        const courseMatch = replyToText.match(/\[Course:\s*([^\]]+)\]/);
        const userId = userMatch ? userMatch[1].trim() : '';
        const courseId = courseMatch ? courseMatch[1].trim() : '';

        // Map text (mon, wed, friday) to numbers
        const dayMap: Record<string, number> = {
          'su': 0, 'sun': 0, 'sunday': 0,
          'mo': 1, 'mon': 1, 'monday': 1,
          'tu': 2, 'tue': 2, 'tuesday': 2,
          'we': 3, 'wed': 3, 'wednesday': 3,
          'th': 4, 'thu': 4, 'thursday': 4,
          'fr': 5, 'fri': 5, 'friday': 5,
          'sa': 6, 'sat': 6, 'saturday': 6,
        };

        const parts = responseText.toLowerCase().replace(/[^a-z0-9, ]/g, '').split(',').map((p: string) => p.trim());
        const days = parts.map((p: string) => {
          if (!isNaN(parseInt(p)) && parseInt(p) >= 0 && parseInt(p) <= 6) return parseInt(p);
          return dayMap[p];
        }).filter((d: number | undefined) => d !== undefined) as number[];

        // Unique days
        const uniqueDays = Array.from(new Set(days)).sort();

        if (uniqueDays.length === 0) {
          await sendMsg(messageChatId,
            `❌ Could not parse any days. Please enter comma-separated days (e.g. Mon, Wed, Fri):\n\n[Session: enter_week_days]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
          return NextResponse.json({ ok: true });
        }

        const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, courseId) });
        if (!course) return NextResponse.json({ ok: true });

        const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
        const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
        const curriculum = ensureGroupInheritance(populatedCurriculum);
        const groups = collectSecondChildGroups(curriculum);
        const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

        const targetDates = computeReleaseGroupDates(groups, {
          releaseMode: 'day_of_week' as any,
          releaseStartAt: new Date(),
          releaseIntervalDays: course.releaseIntervalDays || 7,
          releaseGroupsPerWeek: course.releaseGroupsPerWeek,
          releaseDaysOfWeek: uniqueDays,
          releaseGroupDates: {},
        });

        const dataToInsert = Object.entries(targetDates).map(([groupId, dateStr]) => ({
          id: randomUUID(),
          courseId,
          userId,
          lessonNodeId: groupIdToNodeId.get(groupId)!,
          availabilityMode: 'available',
          availableAt: dateStr ? new Date(dateStr) : null,
        }));

        await db.transaction(async (tx) => {
          await tx.delete(schema.studentModuleAvailability).where(and(eq(schema.studentModuleAvailability.courseId, courseId), eq(schema.studentModuleAvailability.userId, userId)));
          if (dataToInsert.length > 0) {
            await tx.insert(schema.studentModuleAvailability).values(dataToInsert as any);
          }
        });

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const parsedNames = uniqueDays.map(d => dayNames[d]).join(', ');
        await sendMsg(messageChatId, `✅ <b>Module availability set to week days</b>\n\n📚 <b>Course:</b> ${course.title}\n📅 <b>Selected Days:</b> ${parsedNames}`);
      }

      else if (replyToText.includes('[Session: enter_interval]')) {
        const userMatch = replyToText.match(/\[User:\s*([^\]]+)\]/);
        const courseMatch = replyToText.match(/\[Course:\s*([^\]]+)\]/);
        const userId = userMatch ? userMatch[1].trim() : '';
        const courseId = courseMatch ? courseMatch[1].trim() : '';

        const interval = parseInt(responseText);
        if (isNaN(interval) || interval < 1) {
          await sendMsg(messageChatId,
            `❌ Invalid number. Please enter the day interval as a positive number (e.g. 7):\n\n[Session: enter_interval]\n[User: ${userId}]\n[Course: ${courseId}]`,
            { reply_markup: { force_reply: true, selective: true }, parse_mode: undefined }
          );
          return NextResponse.json({ ok: true });
        }

        const course = await db.query.courses.findFirst({ where: eq(schema.courses.id, courseId) });
        if (!course) return NextResponse.json({ ok: true });

        const rawCurriculum = parseCurriculumJson(course.curriculumJson as string);
        const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
        const curriculum = ensureGroupInheritance(populatedCurriculum);
        const groups = collectSecondChildGroups(curriculum);
        const groupIdToNodeId = new Map(groups.map(g => [g.id, g.nodeId]));

        const targetDates = computeReleaseGroupDates(groups, {
          releaseMode: 'fixed_interval',
          releaseStartAt: new Date(),
          releaseIntervalDays: interval,
          releaseGroupsPerWeek: course.releaseGroupsPerWeek,
          releaseDaysOfWeek: [],
          releaseGroupDates: {},
        });

        const dataToInsert = Object.entries(targetDates).map(([groupId, dateStr]) => ({
          id: randomUUID(),
          courseId,
          userId,
          lessonNodeId: groupIdToNodeId.get(groupId)!,
          availabilityMode: 'available',
          availableAt: dateStr ? new Date(dateStr) : null,
        }));

        await db.transaction(async (tx) => {
          await tx.delete(schema.studentModuleAvailability).where(and(eq(schema.studentModuleAvailability.courseId, courseId), eq(schema.studentModuleAvailability.userId, userId)));
          if (dataToInsert.length > 0) {
            await tx.insert(schema.studentModuleAvailability).values(dataToInsert as any);
          }
        });

        await sendMsg(messageChatId, `✅ <b>Module availability set to ${interval} days interval</b>\n\n📚 <b>Course:</b> ${course.title}`);


      }
    }

    // ─── TEXT COMMAND HANDLER ───
    if (body.message && body.message.text && !body.message.reply_to_message) {
      const text = (body.message.text || '').trim();
      const messageChatId = body.message.chat.id;

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

      if (text.startsWith('/student')) {
        const email = text.replace('/student', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/student email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
          columns: { id: true, fullName: true, email: true, role: true, phone: true, createdAt: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        const rawEnrollments = await db.query.orders.findMany({
          where: and(eq(schema.orders.userId, student.id), eq(schema.orders.status, 'approved')),
        });

        const courseIds = [...new Set(rawEnrollments.map(o => o.courseId).filter(Boolean))] as string[];
        const courses = courseIds.length > 0
          ? await db.query.courses.findMany({
              where: inArray(schema.courses.id, courseIds),
              columns: { id: true, title: true }
            })
          : [];
        const courseMap = new Map(courses.map(c => [c.id, c]));

        const enrollments = rawEnrollments.map((o) => ({
          ...o,
          course: courseMap.get(o.courseId) || null,
        })).filter(o => o.course !== null) as any[];

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

      if (text.startsWith('/enroll')) {
        const email = text.replace('/enroll', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/enroll email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
          columns: { id: true, fullName: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        const courses = await db.query.courses.findMany({
          where: eq(schema.courses.status, 'published'),
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

      if (text.startsWith('/availability')) {
        const email = text.replace('/availability', '').trim();
        if (!email) {
          await sendMsg(messageChatId, '❌ Usage: <code>/availability email@example.com</code>');
          return NextResponse.json({ ok: true });
        }

        const student = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
          columns: { id: true, fullName: true }
        });

        if (!student) {
          await sendMsg(messageChatId, `❌ No user found with email: <code>${email}</code>`);
          return NextResponse.json({ ok: true });
        }

        const rawEnrolledOrders = await db.query.orders.findMany({
          where: and(eq(schema.orders.userId, student.id), eq(schema.orders.status, 'approved')),
        });

        const courseIds = [...new Set(rawEnrolledOrders.map(o => o.courseId).filter(Boolean))] as string[];
        const courses = courseIds.length > 0
          ? await db.query.courses.findMany({ where: inArray(schema.courses.id, courseIds) })
          : [];
        const courseMap = new Map(courses.map(c => [c.id, c]));

        const enrolledOrders = rawEnrolledOrders.map((o) => ({
          ...o,
          course: courseMap.get(o.courseId) || null,
        })).filter(o => o.course !== null) as any[];

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
    try {
      const fromId = body?.callback_query?.from?.id || body?.message?.from?.id;
      const chatId = body?.callback_query?.message?.chat?.id || body?.message?.chat?.id;
      const targetId = chatId || fromId;
      if (targetId) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN?.replace(/"/g, '');
        const sendMsgUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await fetch(sendMsgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetId,
            text: `❌ <b>Webhook Error:</b>\n<pre>${error.stack || error.message || String(error)}</pre>`,
            parse_mode: 'HTML',
          }),
        });
      }
    } catch (e) {
      console.error('Failed to send error message to Telegram:', e);
    }
    return NextResponse.json({ ok: true, error: error.message });
  }
}
