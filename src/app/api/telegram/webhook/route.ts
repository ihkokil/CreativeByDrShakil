import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { decompressUuid, compressUuid, sendTelegramEnrollmentNotification, editTelegramMessage, sanitizeTelegramReplyMarkup } from '@/lib/telegram';
import { ensureCourseEnrollment, ensureCustomBatch, ensureDefaultBatches, ensureAllUnlockedBatch, applyStudentScheduleRule } from '@/lib/enrollment';

function getTelegramToken() {
  const raw = process.env.TELEGRAM_BOT_TOKEN;
  if (!raw) return '';
  return raw.replace(/^['"]|['"]$/g, '').replace(/['"]/g, '').trim();
}

function escapeHtml(value: string) {
  if (!value) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

interface PendingDatePrompt {
  compUserId: string;
  compCourseId: string;
  timestamp: number;
}

const pendingDatePrompts: Map<string, PendingDatePrompt> =
  ((globalThis as any)._pendingTelegramDatePrompts =
    (globalThis as any)._pendingTelegramDatePrompts || new Map<string, PendingDatePrompt>());

function savePendingCustomDatePrompt(chatId: string | number, compUserId: string, compCourseId: string) {
  pendingDatePrompts.set(String(chatId), {
    compUserId,
    compCourseId,
    timestamp: Date.now(),
  });
}

function getPendingCustomDatePrompt(chatId: string | number): PendingDatePrompt | null {
  const entry = pendingDatePrompts.get(String(chatId));
  if (!entry) return null;
  // Expire after 15 minutes
  if (Date.now() - entry.timestamp > 15 * 60 * 1000) {
    pendingDatePrompts.delete(String(chatId));
    return null;
  }
  return entry;
}

function clearPendingCustomDatePrompt(chatId: string | number) {
  pendingDatePrompts.delete(String(chatId));
}

function parseCustomDate(input: string): Date | null {
  if (!input) return null;
  const str = input.trim().toLowerCase();
  const now = new Date();

  if (str === 'today') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (str === 'yesterday') {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }
  const relMatch = str.match(/^(\d+)\s*(d|day|days|w|week|weeks)\s*(ago)?$/);
  if (relMatch) {
    const count = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const days = unit.startsWith('w') ? count * 7 : count;
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - days);
    return d;
  }

  // Check DD-MM-YYYY or YYYY-MM-DD separated by -, /, ., or spaces
  const parts = str.split(/[-/.\s]+/);
  if (parts.length === 3) {
    let day: number, month: number, year: number;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
    if (year >= 2020 && year <= 2040 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }
  return null;
}

async function applyCustomEnrollmentDate(
  supabase: any,
  chatId: string | number,
  userId: string,
  courseId: string,
  targetDate: Date
) {
  const customIso = targetDate.toISOString();
  const isoDate = customIso.split('T')[0];

  const expDate = new Date(targetDate);
  expDate.setUTCFullYear(expDate.getUTCFullYear() + 1);
  const expiresIso = expDate.toISOString();

  const { data: courseInfo } = await supabase
    .from('Course')
    .select('title, releaseMode')
    .eq('id', courseId)
    .limit(1)
    .maybeSingle();

  const courseMode = courseInfo?.releaseMode;
  const releaseMode = (courseMode && ['fixed_interval', 'groups_per_week', 'day_of_week'].includes(courseMode))
    ? courseMode
    : 'custom_batch';

  await applyStudentScheduleRule({
    supabase,
    courseId,
    userIds: [userId],
    action: releaseMode,
    startDate: targetDate,
  });

  const [uRes, cRes] = await Promise.all([
    supabase.from('User').select('fullName, email').eq('id', userId).limit(1).maybeSingle(),
    supabase.from('Course').select('title').eq('id', courseId).limit(1).maybeSingle(),
  ]);

  const studentName = uRes.data?.fullName || 'Student';
  const studentEmail = uRes.data?.email || '';
  const courseTitle = cRes.data?.title || 'Course';

  const formattedDate = targetDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const formattedExp = expDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const keyboard = [
    [
      { text: '⚙️ Change Settings Again', callback_data: `avc|${compressUuid(userId)}|${compressUuid(courseId)}` },
      { text: '👤 Student Courses', callback_data: `av|${compressUuid(userId)}` },
    ],
  ];

  await sendTelegramReply(
    chatId,
    `✅ <b>Custom Enrollment Date Applied</b>\n\n` +
    `👤 <b>Student:</b> ${escapeHtml(studentName)} (<code>${escapeHtml(studentEmail)}</code>)\n` +
    `📚 <b>Course:</b> ${escapeHtml(courseTitle)}\n` +
    `🗓 <b>Batch:</b> Start Today Batch\n` +
    `📅 <b>Custom Date:</b> <code>${formattedDate} (${isoDate})</code>\n` +
    `⏳ <b>Access Valid Until:</b> <code>${formattedExp}</code>\n\n` +
    `<i>Module availability timeline now calculates starting from this date.</i>`,
    { inline_keyboard: keyboard }
  );
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = getTelegramToken();
  if (!token || !callbackQueryId) return;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || '',
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Telegram Webhook] answerCallbackQuery failed:', res.status, errBody);
    }
  } catch (err) {
    console.error('[Telegram Webhook] answerCallbackQuery error:', err);
  }
}

async function sendTelegramReply(chatId: string | number, text: string, replyMarkup?: any) {
  const token = getTelegramToken();
  if (!token) {
    console.warn('[Telegram Webhook] TELEGRAM_BOT_TOKEN missing, cannot send reply');
    return;
  }

  const sanitizedMarkup = sanitizeTelegramReplyMarkup(replyMarkup);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: sanitizedMarkup,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Telegram Webhook] sendMessage failed:', res.status, errBody);

      // If HTML entity parsing fails, retry as plain text so it never fails silently
      if (errBody.includes('can\'t parse entities') || errBody.includes('entity')) {
        const plainText = text.replace(/<[^>]+>/g, '');
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: plainText,
            reply_markup: sanitizedMarkup,
            disable_web_page_preview: true,
          }),
        });
      }
    }
  } catch (err) {
    console.error('[Telegram Webhook] sendMessage error:', err);
  }
}

export async function POST(request: NextRequest) {
  let globalCallbackQueryId: string | undefined = undefined;
  let currentChatId: string | number | undefined = undefined;

  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const callbackQuery = body?.callback_query;
    if (callbackQuery?.id) {
      globalCallbackQueryId = callbackQuery.id;
    }
    if (callbackQuery?.message?.chat?.id) {
      currentChatId = callbackQuery.message.chat.id;
    } else if (body?.message?.chat?.id) {
      currentChatId = body.message.chat.id;
    }

    // -------------------------------------------------------------
    // 1. Text Messages & Bot Commands
    // -------------------------------------------------------------
    if (!callbackQuery) {
      const message = body?.message;
      if (message && message.text) {
        const text = message.text.trim();
        const chatId = message.chat.id;

        if (text === '/start' || text === '/help') {
          await sendTelegramReply(
            chatId,
            `Hello! 👋 Welcome to <b>Creative by Dr. Shakil</b> Assistant Bot.\n\n` +
            `Your Telegram Chat ID is: <code>${chatId}</code>\n\n` +
            `<b>Commands:</b>\n` +
            `• <code>/student &lt;name, email, or phone&gt;</code> - Search students & manage enrollments\n` +
            `• <code>/chatid</code> - View your chat ID`
          );
          return NextResponse.json({ ok: true });
        }

        if (text === '/chatid') {
          await sendTelegramReply(chatId, `Your Chat ID: <code>${chatId}</code>`);
          return NextResponse.json({ ok: true });
        }

        if (text.startsWith('/student')) {
          const query = text.replace(/^\/student(@\w+)?\s*/i, '').trim();

          if (!query) {
            await sendTelegramReply(
              chatId,
              `ℹ️ <b>Student Lookup Usage:</b>\n<code>/student &lt;email, phone, or name&gt;</code>\n\n<b>Example:</b>\n<code>/student ihkokil@gmail.com</code>`
            );
            return NextResponse.json({ ok: true });
          }

          const { data: matchedUsers } = await supabase
            .from('User')
            .select('id, fullName, email, phone, role, createdAt')
            .or(`email.ilike.%${query}%,phone.ilike.%${query}%,fullName.ilike.%${query}%`)
            .limit(5);

          if (!matchedUsers || matchedUsers.length === 0) {
            await sendTelegramReply(chatId, `❌ <b>No student found</b> matching "<code>${escapeHtml(query)}</code>".`);
            return NextResponse.json({ ok: true });
          }

          for (const user of matchedUsers) {
            const { data: orders = [] } = await supabase
              .from('Order')
              .select('courseId')
              .eq('userId', user.id)
              .eq('status', 'approved');

            const courseIds = [...new Set((orders || []).map((o: any) => o.courseId).filter(Boolean))];
            const { data: courses = [] } = courseIds.length > 0
              ? await supabase.from('Course').select('title').in('id', courseIds)
              : { data: [] };

            const courseTitles = (courses || []).map((c: any) => c.title).join(', ') || 'None';

            const replyText = [
              '👤 <b>Student Details Found</b>',
              '',
              `<b>Name:</b> ${escapeHtml(user.fullName)}`,
              `<b>Email:</b> ${escapeHtml(user.email)}`,
              `<b>Phone:</b> ${escapeHtml(user.phone || 'N/A')}`,
              `<b>ID:</b> <code>${user.id}</code>`,
              `<b>Role:</b> ${escapeHtml(user.role)}`,
              `<b>Enrolled Courses:</b> ${escapeHtml(courseTitles)}`,
              '',
              'Select an action below:'
            ].join('\n');

            const keyboard = {
              inline_keyboard: [
                [
                  { text: '📚 Enroll Course', callback_data: `en|${compressUuid(user.id)}` },
                  { text: '⚙️ Change Module Availability', callback_data: `av|${compressUuid(user.id)}` }
                ]
              ]
            };

            await sendTelegramReply(chatId, replyText, keyboard);
          }
          return NextResponse.json({ ok: true });
        }

        // Check for ForceReply context or active pending prompt for custom dates
        let targetContext: { compUserId: string; compCourseId: string } | null = null;

        if (message.reply_to_message && message.reply_to_message.text) {
          const rText = message.reply_to_message.text;
          const contextMatch = rText.match(/\[Context: (amcd\|[^\]]+|ed\|[^\]]+)\]/);
          if (contextMatch) {
            const parts = contextMatch[1].split('|');
            targetContext = { compUserId: parts[1], compCourseId: parts[2] };
          }
        }

        // Fallback: Check if this chat recently initiated a custom date prompt
        if (!targetContext) {
          const pending = getPendingCustomDatePrompt(chatId);
          if (pending) {
            targetContext = { compUserId: pending.compUserId, compCourseId: pending.compCourseId };
          }
        }

        if (targetContext) {
          const dateObj = parseCustomDate(text);
          if (!dateObj) {
            await sendTelegramReply(
              chatId,
              `❌ <b>Unrecognized Date:</b> "<code>${escapeHtml(text)}</code>"\n\n` +
              `Please enter a valid date in <b>DD-MM-YYYY</b> format (e.g. <code>15-08-2026</code>) or <code>YYYY-MM-DD</code>.\n` +
              `You can also type relative phrases like <code>today</code>, <code>yesterday</code>, or <code>7 days ago</code>.`
            );
            return NextResponse.json({ ok: true });
          }

          const userId = decompressUuid(targetContext.compUserId);
          const courseId = decompressUuid(targetContext.compCourseId);

          await applyCustomEnrollmentDate(supabase, chatId, userId, courseId, dateObj);
          clearPendingCustomDatePrompt(chatId);
          return NextResponse.json({ ok: true });
        }

        // Helpful hint if user entered a date without context
        const looseDate = parseCustomDate(text);
        if (looseDate && /[-/.]|\b(today|yesterday|ago)\b/i.test(text)) {
          const iso = looseDate.toISOString().split('T')[0];
          await sendTelegramReply(
            chatId,
            `ℹ️ <b>Date Received:</b> <code>${iso}</code>\n\n` +
            `To apply this enrollment date to a student:\n` +
            `1. Search for the student by typing their name, email, or phone number.\n` +
            `2. Tap <b>⚙️ Change Module Availability</b>.\n` +
            `3. Select the course and tap <b>📆 Custom Date</b>.\n` +
            `4. Tap <b>✍️ Type Specific Date</b> then send the date.`
          );
          return NextResponse.json({ ok: true });
        }

        await sendTelegramReply(chatId, `Command received: ${text}\nYour Chat ID: <code>${chatId}</code>`);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: true });
    }

    // -------------------------------------------------------------
    // 2. Interactive Callback Queries
    // -------------------------------------------------------------
    let callbackData = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;
    const messageId = callbackQuery.message?.message_id;
    const callbackQueryId = callbackQuery.id;

    if (!callbackData || !chatId) {
      return NextResponse.json({ ok: true });
    }

    // Support legacy callback query patterns
    if (callbackData.startsWith('enroll_course_') || callbackData.startsWith('enroll|') || callbackData.startsWith('reg_enroll|')) {
      const parts = callbackData.includes('|') ? callbackData.split('|') : callbackData.split('_');
      const rawId = parts[parts.length - 1];
      callbackData = `en|${rawId.length === 36 ? compressUuid(rawId) : rawId}`;
    } else if (callbackData.startsWith('availability|') || callbackData.startsWith('reg_avail|')) {
      const parts = callbackData.includes('|') ? callbackData.split('|') : callbackData.split('_');
      const rawId = parts[parts.length - 1];
      callbackData = `av|${rawId.length === 36 ? compressUuid(rawId) : rawId}`;
    }

    // =============================================================
    // A. CHECKOUT PAYMENT DECISION (Accept / Reject)
    // =============================================================

    // Handle "pa|{compOrderId}" — Accept clicked -> show batches for enrollment
    if (callbackData.startsWith('pa|')) {
      const compOrderId = callbackData.split('|')[1];
      const orderId = decompressUuid(compOrderId);

      const { data: order } = await (supabase.from('Order') as any)
        .select('id, userId, courseId, totalAmount, status')
        .eq('id', orderId)
        .limit(1)
        .maybeSingle();

      if (!order) {
        await answerCallbackQuery(callbackQueryId, 'Order not found.');
        return NextResponse.json({ ok: true });
      }

      if (order.status === 'approved') {
        await answerCallbackQuery(callbackQueryId, 'This order is already approved.');
        return NextResponse.json({ ok: true });
      }

      if (order.status === 'rejected') {
        await answerCallbackQuery(callbackQueryId, 'This order is marked as rejected.');
        return NextResponse.json({ ok: true });
      }

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', order.userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title, releaseMode').eq('id', order.courseId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;

      if (!user || !course) {
        await answerCallbackQuery(callbackQueryId, 'User or course not found.');
        return NextResponse.json({ ok: true });
      }

      const { customBatch, instantBatch } = await ensureDefaultBatches(supabase, course.id);

      const keyboard: any[] = [];
      // 1. All Unlocked Batch
      keyboard.push([{
        text: `⚡ All Unlocked Batch`,
        callback_data: `pab|${compOrderId}|${compressUuid(instantBatch.id)}`
      }]);

      // 2. Up to 3 latest teacher batches
      const { data: teacherBatches } = await (supabase.from('Batch') as any)
        .select('id, name, createdAt')
        .eq('courseId', course.id)
        .not('name', 'ilike', '%Custom%')
        .not('name', 'ilike', '%Instant%')
        .not('name', 'ilike', '%Start Today%')
        .not('name', 'ilike', '%All Unlocked%')
        .order('createdAt', { ascending: false })
        .limit(3);

      if (teacherBatches && teacherBatches.length > 0) {
        teacherBatches.forEach((b: any) => {
          keyboard.push([{
            text: `🗓 ${b.name}`,
            callback_data: `pab|${compOrderId}|${compressUuid(b.id)}`
          }]);
        });
      }

      // 3. Start Today Batch
      keyboard.push([{
        text: `🚀 Start Today Batch`,
        callback_data: `pab|${compOrderId}|${compressUuid(customBatch.id)}`
      }]);

      // 4. Option to Reject
      keyboard.push([{
        text: `❌ Reject Payment`,
        callback_data: `pr|${compOrderId}`
      }]);

      await answerCallbackQuery(callbackQueryId, 'Select Batch to Enroll');

      const amountVal = order.totalAmount || order.amount || 0;
      const promptText = [
        '<b>💳 Approve Purchase & Select Batch</b>',
        '',
        `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)`,
        `📚 <b>Course:</b> ${escapeHtml(course.title)}`,
        `💰 <b>Amount:</b> ৳${escapeHtml(String(amountVal))}`,
        `🆔 <b>Order:</b> <code>${escapeHtml(order.id)}</code>`,
        '',
        'Select which batch to enroll this student into:'
      ].join('\n');

      if (messageId) {
        await editTelegramMessage({
          chatId,
          messageId,
          text: promptText,
          replyMarkup: { inline_keyboard: keyboard }
        });
      } else {
        await sendTelegramReply(chatId, promptText, { inline_keyboard: keyboard });
      }

      return NextResponse.json({ ok: true });
    }

    // Handle "pab|{compOrderId}|{compBatchId}" — Finalize Approval with Batch
    if (callbackData.startsWith('pab|')) {
      const parts = callbackData.split('|');
      const orderId = decompressUuid(parts[1]);
      const batchId = decompressUuid(parts[2]);

      const { data: order } = await (supabase.from('Order') as any)
        .select('id, userId, courseId, totalAmount, status')
        .eq('id', orderId)
        .limit(1)
        .maybeSingle();

      if (!order) {
        await answerCallbackQuery(callbackQueryId, 'Order not found.');
        return NextResponse.json({ ok: true });
      }

      const [userRes, courseRes, batchRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', order.userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title').eq('id', order.courseId).limit(1).maybeSingle(),
        supabase.from('Batch').select('id, name, startDate').eq('id', batchId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;
      const batch = batchRes.data as any;

      if (!user || !course || !batch) {
        await answerCallbackQuery(callbackQueryId, 'Record lookup failed.');
        return NextResponse.json({ ok: true });
      }

      const nowIso = new Date().toISOString();
      const bName = (batch.name || '').toLowerCase();
      const isAllUnlocked = bName.includes('all unlocked') || bName.includes('instant');

      // 1. Update Order
      await (supabase.from('Order') as any).update({
        status: 'approved',
        batchId: batch.id,
        enrolledAt: nowIso,
        updatedAt: nowIso,
      } as any).eq('id', order.id);

      // 2. Clear any node overrides so batch rules apply cleanly
      await supabase.from('StudentModuleAvailability').delete().eq('courseId', course.id).eq('userId', user.id);

      // 3. Trigger Enrollment Notification
      sendTelegramEnrollmentNotification({
        studentName: user.fullName,
        studentEmail: user.email,
        courseTitle: course.title,
        batchName: batch.name,
        enrolledByAdmin: true,
      }).catch(err => console.error('[Webhook] Enrollment notification error:', err));

      const amountVal = order.totalAmount || order.amount || 0;
      const successText = [
        '✅ <b>Payment Approved & Enrolled</b>',
        '',
        `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)`,
        `📚 <b>Course:</b> ${escapeHtml(course.title)}`,
        `🗓 <b>Batch:</b> ${escapeHtml(batch.name)}`,
        `💰 <b>Amount:</b> ৳${escapeHtml(String(amountVal))}`,
        `🆔 <b>Order ID:</b> <code>${escapeHtml(order.id)}</code>`,
        `🕒 <b>Approved At:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`,
        '',
        isAllUnlocked 
          ? '<i>⚡ All modules are unlocked immediately for full instant access.</i>' 
          : '<i>🗓 Modules will unlock following this batch schedule.</i>'
      ].join('\n');

      await answerCallbackQuery(callbackQueryId, '✅ Approved & Enrolled!');
      if (messageId) {
        await editTelegramMessage({
          chatId,
          messageId,
          text: successText,
          replyMarkup: { inline_keyboard: [] }
        });
      } else {
        await sendTelegramReply(chatId, successText);
      }

      return NextResponse.json({ ok: true });
    }

    // Handle "pr|{compOrderId}" — Reject Purchase
    if (callbackData.startsWith('pr|')) {
      const orderId = decompressUuid(callbackData.split('|')[1]);

      const { data: order } = await (supabase.from('Order') as any)
        .select('id, userId, courseId, totalAmount, status')
        .eq('id', orderId)
        .limit(1)
        .maybeSingle();

      if (!order) {
        await answerCallbackQuery(callbackQueryId, 'Order not found.');
        return NextResponse.json({ ok: true });
      }

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', order.userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title').eq('id', order.courseId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;

      const nowIso = new Date().toISOString();
      await (supabase.from('Order') as any).update({
        status: 'rejected',
        updatedAt: nowIso,
      } as any).eq('id', order.id);

      const amountVal = order.totalAmount || order.amount || 0;
      const rejectText = [
        '❌ <b>Payment Rejected</b>',
        '',
        `👤 <b>Student:</b> ${escapeHtml(user?.fullName || 'Student')} (<code>${escapeHtml(user?.email || '')}</code>)`,
        `📚 <b>Course:</b> ${escapeHtml(course?.title || 'Course')}`,
        `💰 <b>Amount:</b> ৳${escapeHtml(String(amountVal))}`,
        `🆔 <b>Order ID:</b> <code>${escapeHtml(order.id)}</code>`,
        `🕒 <b>Rejected At:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`,
      ].join('\n');

      await answerCallbackQuery(callbackQueryId, '❌ Payment Rejected.');
      if (messageId) {
        await editTelegramMessage({
          chatId,
          messageId,
          text: rejectText,
        });
      } else {
        await sendTelegramReply(chatId, rejectText);
      }

      return NextResponse.json({ ok: true });
    }

    // =============================================================
    // B. ENROLL COURSE WORKFLOW
    // =============================================================

    // Handle "en|{compUserId}" — Show published courses to enroll
    if (callbackData.startsWith('en|')) {
      const compUserId = callbackData.split('|')[1];
      const userId = decompressUuid(compUserId);

      const { data: user }: { data: any } = await supabase
        .from('User')
        .select('id, fullName, email')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();

      if (!user) {
        await answerCallbackQuery(callbackQueryId, 'User not found.');
        return NextResponse.json({ ok: true });
      }

      const { data: courses = [] } = await supabase
        .from('Course')
        .select('id, title')
        .eq('status', 'published')
        .order('title', { ascending: true });

      if (!courses || courses.length === 0) {
        await answerCallbackQuery(callbackQueryId, 'No published courses available.');
        return NextResponse.json({ ok: true });
      }

      const keyboard = (courses || []).map((c: any) => ([{
        text: `📚 ${c.title}`,
        callback_data: `ec|${compUserId}|${compressUuid(c.id)}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select a course');
      await sendTelegramReply(
        chatId,
        `<b>Enroll ${escapeHtml(user.fullName)}</b>\n\nSelect a course to enroll this student into:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "ec|{compUserId}|{compCourseId}" — Show Batches for chosen course
    if (callbackData.startsWith('ec|')) {
      const parts = callbackData.split('|');
      const compUserId = parts[1];
      const courseId = decompressUuid(parts[2]);

      const [courseRes, batchesRes] = await Promise.all([
        supabase.from('Course').select('id, title').eq('id', courseId).limit(1).maybeSingle(),
        ensureDefaultBatches(supabase, courseId),
      ]);

      const course = courseRes.data as any;
      if (!course) {
        await answerCallbackQuery(callbackQueryId, 'Course not found.');
        return NextResponse.json({ ok: true });
      }

      const { customBatch, instantBatch } = batchesRes;

      const keyboard: any[] = [];
      // 1. All Unlocked Batch
      keyboard.push([{
        text: `⚡ All Unlocked Batch (Instant Access)`,
        callback_data: `eb|${compUserId}|${compressUuid(instantBatch.id)}|ins`
      }]);

      // 2. Up to 3 latest teacher batches
      const { data: teacherBatches } = await (supabase.from('Batch') as any)
        .select('id, name, createdAt')
        .eq('courseId', courseId)
        .not('name', 'ilike', '%Custom%')
        .not('name', 'ilike', '%Instant%')
        .not('name', 'ilike', '%Start Today%')
        .not('name', 'ilike', '%All Unlocked%')
        .order('createdAt', { ascending: false })
        .limit(3);

      if (teacherBatches && teacherBatches.length > 0) {
        teacherBatches.forEach((b: any) => {
          keyboard.push([{
            text: `🗓 ${b.name}`,
            callback_data: `eb|${compUserId}|${compressUuid(b.id)}|bat`
          }]);
        });
      }

      // 3. Start Today Batch
      keyboard.push([{
        text: `🚀 Start Today Batch`,
        callback_data: `eb|${compUserId}|${compressUuid(customBatch.id)}|tod`
      }]);

      await answerCallbackQuery(callbackQueryId, 'Select a batch');
      await sendTelegramReply(
        chatId,
        `<b>Select Batch for ${escapeHtml(course.title)}:</b>`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "eb|{compUserId}|{compBatchId}|{subMode}" — Execute enrollment into batch
    if (callbackData.startsWith('eb|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const batchId = decompressUuid(parts[2]);
      const subMode = parts[3] || 'bat';

      const [userRes, batchRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Batch').select('id, name, courseId, startDate').eq('id', batchId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const batch = batchRes.data as any;

      if (!user || !batch) {
        await answerCallbackQuery(callbackQueryId, 'User or Batch not found.');
        return NextResponse.json({ ok: true });
      }

      const { data: course } = await supabase
        .from('Course')
        .select('id, title, slug')
        .eq('id', batch.courseId)
        .limit(1)
        .maybeSingle();

      const courseTitle = course?.title || 'Course';
      const courseSlug = course?.slug || null;

      const now = new Date();
      await ensureCourseEnrollment(null, user.id, batch.courseId, courseTitle, courseSlug, true, now, undefined, batch.id);

      // Clear any individual node overrides
      await supabase.from('StudentModuleAvailability').delete().eq('courseId', batch.courseId).eq('userId', user.id);

      // Send Enrollment Notification
      sendTelegramEnrollmentNotification({
        studentName: user.fullName,
        studentEmail: user.email,
        courseTitle: courseTitle,
        batchName: batch.name,
        enrolledByAdmin: true,
      }).catch(err => console.error('[Webhook] Enrollment notification error:', err));

      const isAllUnlocked = (batch.name || '').toLowerCase().includes('all unlocked') || (batch.name || '').toLowerCase().includes('instant');

      const enrolledText = [
        '✅ <b>Student Enrolled Successfully</b>',
        '',
        `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)`,
        `📚 <b>Course:</b> ${escapeHtml(courseTitle)}`,
        `🗓 <b>Batch:</b> ${escapeHtml(batch.name)}`,
        `🕒 <b>Enrolled At:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })}`,
        '',
        isAllUnlocked
          ? '<i>⚡ All modules are unlocked immediately for full instant access.</i>'
          : '<i>🗓 Modules will unlock following this batch schedule.</i>'
      ].join('\n');

      await answerCallbackQuery(callbackQueryId, '✅ Enrolled!');
      await sendTelegramReply(chatId, enrolledText);

      return NextResponse.json({ ok: true });
    }

    // =============================================================
    // C. CHANGE MODULE AVAILABILITY WORKFLOW
    // =============================================================

    // Handle "av|{compUserId}" — List student's enrolled courses
    if (callbackData.startsWith('av|')) {
      const compUserId = callbackData.split('|')[1];
      const userId = decompressUuid(compUserId);

      const { data: user }: { data: any } = await supabase
        .from('User')
        .select('id, fullName, email')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();

      if (!user) {
        await answerCallbackQuery(callbackQueryId, 'User not found.');
        return NextResponse.json({ ok: true });
      }

      // Query student's active enrollments
      const { data: orders = [] } = await supabase
        .from('Order')
        .select('courseId')
        .eq('userId', userId)
        .eq('status', 'approved');

      const courseIds = [...new Set((orders || []).map((o: any) => o.courseId).filter(Boolean))];

      if (courseIds.length === 0) {
        await answerCallbackQuery(callbackQueryId, 'No enrolled courses.');
        await sendTelegramReply(
          chatId,
          `⚠️ <b>${escapeHtml(user.fullName)}</b> has no active course enrollments.`,
          {
            inline_keyboard: [[
              { text: '📚 Enroll in a Course', callback_data: `en|${compUserId}` }
            ]]
          }
        );
        return NextResponse.json({ ok: true });
      }

      const { data: courses = [] } = await supabase
        .from('Course')
        .select('id, title')
        .in('id', courseIds);

      const keyboard = (courses || []).map((c: any) => ([{
        text: `⚙️ ${c.title}`,
        callback_data: `avc|${compUserId}|${compressUuid(c.id)}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select course');
      await sendTelegramReply(
        chatId,
        `<b>Change Module Availability for ${escapeHtml(user.fullName)}</b>\n\nSelect which course to update:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "avc|{compUserId}|{compCourseId}" — Show 6 availability options
    if (callbackData.startsWith('avc|')) {
      const parts = callbackData.split('|');
      const compUserId = parts[1];
      const compCourseId = parts[2];
      const courseId = decompressUuid(compCourseId);

      const { data: course } = await supabase
        .from('Course')
        .select('title')
        .eq('id', courseId)
        .limit(1)
        .maybeSingle();

      const keyboard = [
        [{ text: `1. ⚡ Instant Unlock (All Unlocked Batch)`, callback_data: `am|${compUserId}|${compCourseId}|ins` }],
        [{ text: `2. ⏳ Fixed Interval`, callback_data: `am|${compUserId}|${compCourseId}|fix_menu` }],
        [{ text: `3. 📦 Groups Per Week`, callback_data: `am|${compUserId}|${compCourseId}|gpw_menu` }],
        [{ text: `4. 📅 Day of Week`, callback_data: `am|${compUserId}|${compCourseId}|dow_menu` }],
        [{ text: `5. 🔀 Batch Change`, callback_data: `am|${compUserId}|${compCourseId}|bat_menu` }],
        [{ text: `6. 📆 Custom Date`, callback_data: `am|${compUserId}|${compCourseId}|dt_m` }],
      ];

      await answerCallbackQuery(callbackQueryId, 'Select option');
      await sendTelegramReply(
        chatId,
        `<b>Module Availability Options</b>\nCourse: <b>${escapeHtml(course?.title || 'Selected Course')}</b>\n\nChoose an option below:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "am|{compUserId}|{compCourseId}|{action}" — Actions & Submenus
    if (callbackData.startsWith('am|')) {
      const parts = callbackData.split('|');
      const compUserId = parts[1];
      const compCourseId = parts[2];
      const action = parts[3];

      const userId = decompressUuid(compUserId);
      const courseId = decompressUuid(compCourseId);

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;

      if (!user || !course) {
        await answerCallbackQuery(callbackQueryId, 'User or course not found.');
        return NextResponse.json({ ok: true });
      }

      // 1. Instant Unlock
      if (action === 'ins') {
        const allUnlockedBatch = await ensureAllUnlockedBatch(supabase, course.id);

        // Reassign student to All Unlocked Batch
        await (supabase.from('Order') as any).update({
          batchId: allUnlockedBatch.id,
          updatedAt: new Date().toISOString(),
        } as any).eq('courseId', course.id).eq('userId', user.id).eq('status', 'approved');

        // Clear node overrides
        await supabase.from('StudentModuleAvailability').delete().eq('courseId', course.id).eq('userId', user.id);

        await answerCallbackQuery(callbackQueryId, '⚡ Instant Unlock Applied!');
        await sendTelegramReply(
          chatId,
          `⚡ <b>Instant Unlock Applied</b>\n\n` +
          `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)\n` +
          `📚 <b>Course:</b> ${escapeHtml(course.title)}\n` +
          `🗓 <b>Batch:</b> All Unlocked Batch\n\n` +
          `<i>All modules are unlocked immediately for full access.</i>`
        );
        return NextResponse.json({ ok: true });
      }

      // 2. Fixed Interval Menu
      if (action === 'fix_menu') {
        const intervals = [1, 2, 3, 5, 7, 14];
        const keyboard = [
          intervals.slice(0, 3).map(d => ({ text: `${d} Day${d > 1 ? 's' : ''}`, callback_data: `ami|${compUserId}|${compCourseId}|${d}` })),
          intervals.slice(3).map(d => ({ text: `${d} Day${d > 1 ? 's' : ''}`, callback_data: `ami|${compUserId}|${compCourseId}|${d}` })),
        ];

        await answerCallbackQuery(callbackQueryId, 'Choose interval');
        await sendTelegramReply(chatId, `<b>Select Interval Duration:</b>\nModules will unlock after every X days.`, { inline_keyboard: keyboard });
        return NextResponse.json({ ok: true });
      }

      // 3. Groups Per Week Menu
      if (action === 'gpw_menu') {
        const gpwOptions = [1, 2, 3, 4];
        const keyboard = [
          gpwOptions.map(g => ({ text: `${g} / wk`, callback_data: `amg|${compUserId}|${compCourseId}|${g}` })),
        ];

        await answerCallbackQuery(callbackQueryId, 'Choose groups per week');
        await sendTelegramReply(chatId, `<b>Select Groups Per Week:</b>\nUnlocks a set number of module groups each week.`, { inline_keyboard: keyboard });
        return NextResponse.json({ ok: true });
      }

      // 4. Day of Week Menu
      if (action === 'dow_menu') {
        const keyboard = [
          [{ text: '🗓 Sat, Mon, Wed', callback_data: `amd|${compUserId}|${compCourseId}|smw` }],
          [{ text: '🗓 Sun, Tue, Thu', callback_data: `amd|${compUserId}|${compCourseId}|stt` }],
          [{ text: '🗓 Friday Only', callback_data: `amd|${compUserId}|${compCourseId}|fri` }],
          [{ text: '🗓 Daily (Every Day)', callback_data: `amd|${compUserId}|${compCourseId}|dly` }],
        ];

        await answerCallbackQuery(callbackQueryId, 'Choose day schedule');
        await sendTelegramReply(chatId, `<b>Select Day of Week Release:</b>\nModules will unlock on the specified days.`, { inline_keyboard: keyboard });
        return NextResponse.json({ ok: true });
      }

      // 5. Batch Change Menu
      if (action === 'bat_menu') {
        const { customBatch, instantBatch } = await ensureDefaultBatches(supabase, course.id);

        const keyboard: any[] = [];
        // All Unlocked
        keyboard.push([{
          text: `⚡ All Unlocked Batch`,
          callback_data: `amb|${compUserId}|${compressUuid(instantBatch.id)}`
        }]);

        // Teacher Batches
        const { data: teacherBatches } = await (supabase.from('Batch') as any)
          .select('id, name')
          .eq('courseId', course.id)
          .not('name', 'ilike', '%Custom%')
          .not('name', 'ilike', '%Instant%')
          .not('name', 'ilike', '%Start Today%')
          .not('name', 'ilike', '%All Unlocked%')
          .order('createdAt', { ascending: false })
          .limit(3);

        if (teacherBatches && teacherBatches.length > 0) {
          teacherBatches.forEach((b: any) => {
            keyboard.push([{
              text: `🗓 ${b.name}`,
              callback_data: `amb|${compUserId}|${compressUuid(b.id)}`
            }]);
          });
        }

        // Start Today
        keyboard.push([{
          text: `🚀 Start Today Batch`,
          callback_data: `amb|${compUserId}|${compressUuid(customBatch.id)}`
        }]);

        await answerCallbackQuery(callbackQueryId, 'Choose batch');
        await sendTelegramReply(chatId, `<b>Select New Batch for ${escapeHtml(user.fullName)}:</b>`, { inline_keyboard: keyboard });
        return NextResponse.json({ ok: true });
      }

      // 6. Custom Date Menu
      if (action === 'dat_menu' || action === 'dt_m' || action === 'dt_menu') {
        const todayStr = new Date().toISOString().split('T')[0];
        const keyboard = [
          [
            { text: `📅 Today (${todayStr})`, callback_data: `amc|${compUserId}|${compCourseId}|td` },
            { text: `📅 Yesterday`, callback_data: `amc|${compUserId}|${compCourseId}|yd` }
          ],
          [
            { text: `⏮ 7 Days Ago (W1)`, callback_data: `amc|${compUserId}|${compCourseId}|7d` },
            { text: `⏮ 14 Days Ago (W2)`, callback_data: `amc|${compUserId}|${compCourseId}|14d` }
          ],
          [
            { text: `⏮ 21 Days Ago (W3)`, callback_data: `amc|${compUserId}|${compCourseId}|21d` },
            { text: `📅 1st of Month`, callback_data: `amc|${compUserId}|${compCourseId}|m1` }
          ],
          [
            { text: `✍️ Type Specific Date (DD-MM-YYYY)`, callback_data: `amcd|${compUserId}|${compCourseId}` }
          ],
          [
            { text: `🔙 Back to Options`, callback_data: `avc|${compUserId}|${compCourseId}` }
          ]
        ];

        await answerCallbackQuery(callbackQueryId, 'Custom date options');
        await sendTelegramReply(
          chatId,
          `<b>Select Custom Enrollment Date:</b>\n` +
          `👤 Student: <b>${escapeHtml(user?.fullName || 'Student')}</b>\n` +
          `📚 Course: <b>${escapeHtml(course?.title || 'Selected Course')}</b>\n\n` +
          `Student will be assigned to <b>Start Today Batch</b> starting from this date. All modules unlock according to this timeline.`,
          { inline_keyboard: keyboard }
        );
        return NextResponse.json({ ok: true });
      }
    }

    // Handle "ami|{compUserId}|{compCourseId}|{days}" — Apply Fixed Interval
    if (callbackData.startsWith('ami|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const courseId = decompressUuid(parts[2]);
      const days = parseInt(parts[3], 10) || 3;

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('title').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      await applyStudentScheduleRule({
        supabase,
        courseId,
        userIds: [userId],
        action: 'fixed_interval',
        intervalDays: days,
      });

      await answerCallbackQuery(callbackQueryId, `Fixed interval (${days}d) applied`);
      await sendTelegramReply(
        chatId,
        `⏳ <b>Fixed Interval Configured</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHtml(userRes.data?.fullName || 'Student')} (<code>${escapeHtml(userRes.data?.email || '')}</code>)\n` +
        `📚 <b>Course:</b> ${escapeHtml(courseRes.data?.title || 'Course')}\n` +
        `⏱ <b>Interval:</b> Every ${days} day(s)\n\n` +
        `<i>Modules unlock sequentially every ${days} days from enrollment.</i>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "amg|{compUserId}|{compCourseId}|{groups}" — Apply Groups Per Week
    if (callbackData.startsWith('amg|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const courseId = decompressUuid(parts[2]);
      const groups = parseInt(parts[3], 10) || 1;

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('title').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      await applyStudentScheduleRule({
        supabase,
        courseId,
        userIds: [userId],
        action: 'groups_per_week',
        groupsPerWeek: groups,
      });

      await answerCallbackQuery(callbackQueryId, `${groups} group(s)/wk applied`);
      await sendTelegramReply(
        chatId,
        `📦 <b>Groups Per Week Configured</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHtml(userRes.data?.fullName || 'Student')} (<code>${escapeHtml(userRes.data?.email || '')}</code>)\n` +
        `📚 <b>Course:</b> ${escapeHtml(courseRes.data?.title || 'Course')}\n` +
        `📊 <b>Rate:</b> ${groups} group(s) per week\n\n` +
        `<i>Unlocks ${groups} module group(s) each week.</i>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "amd|{compUserId}|{compCourseId}|{preset}" — Apply Day of Week Preset
    if (callbackData.startsWith('amd|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const courseId = decompressUuid(parts[2]);
      const preset = parts[3];

      let label = 'Designated Days';
      let daysOfWeek = [0, 2, 4];
      if (preset === 'smw') {
        label = 'Saturday, Monday, Wednesday';
        daysOfWeek = [6, 1, 3];
      } else if (preset === 'stt') {
        label = 'Sunday, Tuesday, Thursday';
        daysOfWeek = [0, 2, 4];
      } else if (preset === 'fri') {
        label = 'Friday Only';
        daysOfWeek = [5];
      } else if (preset === 'dly') {
        label = 'Daily (Every Day)';
        daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      }

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('title').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      await applyStudentScheduleRule({
        supabase,
        courseId,
        userIds: [userId],
        action: 'day_of_week',
        daysOfWeek,
      });

      await answerCallbackQuery(callbackQueryId, `Day schedule applied`);
      await sendTelegramReply(
        chatId,
        `📅 <b>Day of Week Schedule Configured</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHtml(userRes.data?.fullName || 'Student')} (<code>${escapeHtml(userRes.data?.email || '')}</code>)\n` +
        `📚 <b>Course:</b> ${escapeHtml(courseRes.data?.title || 'Course')}\n` +
        `🗓 <b>Schedule:</b> ${escapeHtml(label)}\n\n` +
        `<i>Modules unlock on these specified days.</i>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "amb|{compUserId}|{compBatchId}" — Change Student's Batch
    if (callbackData.startsWith('amb|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const batchId = decompressUuid(parts[2]);

      const [userRes, batchRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Batch').select('id, name, courseId, startDate').eq('id', batchId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const batch = batchRes.data as any;

      if (!user || !batch) {
        await answerCallbackQuery(callbackQueryId, 'User or Batch not found.');
        return NextResponse.json({ ok: true });
      }

      const { data: course } = await supabase.from('Course').select('title').eq('id', batch.courseId).limit(1).maybeSingle();

      // Update Order batchId
      await (supabase.from('Order') as any).update({
        batchId: batch.id,
        updatedAt: new Date().toISOString(),
      } as any).eq('courseId', batch.courseId).eq('userId', user.id).eq('status', 'approved');

      // Clear node overrides
      await supabase.from('StudentModuleAvailability').delete().eq('courseId', batch.courseId).eq('userId', user.id);

      await answerCallbackQuery(callbackQueryId, `Moved to ${batch.name}`);
      await sendTelegramReply(
        chatId,
        `🔀 <b>Batch Assignment Updated</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)\n` +
        `📚 <b>Course:</b> ${escapeHtml(course?.title || 'Course')}\n` +
        `🗓 <b>New Batch:</b> ${escapeHtml(batch.name)}\n\n` +
        `<i>Student is now following the schedule of this batch.</i>`
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "amc|{compUserId}|{compCourseId}|{datePreset}" — Apply Preset Custom Date
    if (callbackData.startsWith('amc|')) {
      const parts = callbackData.split('|');
      const userId = decompressUuid(parts[1]);
      const courseId = decompressUuid(parts[2]);
      const preset = parts[3];

      const now = new Date();
      let targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

      if (preset === 'yd' || preset === 'yesterday') {
        targetDate.setUTCDate(targetDate.getUTCDate() - 1);
      } else if (preset === '7d') {
        targetDate.setUTCDate(targetDate.getUTCDate() - 7);
      } else if (preset === '14d') {
        targetDate.setUTCDate(targetDate.getUTCDate() - 14);
      } else if (preset === '21d') {
        targetDate.setUTCDate(targetDate.getUTCDate() - 21);
      } else if (preset === '28d') {
        targetDate.setUTCDate(targetDate.getUTCDate() - 28);
      } else if (preset === 'm1' || preset === 'month_start') {
        targetDate.setUTCDate(1);
      } else if (preset === 'lm') {
        targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      }
      // 'td' or 'today' stays as today at UTC midnight

      await answerCallbackQuery(callbackQueryId, 'Applying date...');
      await applyCustomEnrollmentDate(supabase, chatId, userId, courseId, targetDate);
      clearPendingCustomDatePrompt(chatId);
      return NextResponse.json({ ok: true });
    }

    // Handle "amcd|{compUserId}|{compCourseId}" — Prompt for Custom Date text input
    if (callbackData.startsWith('amcd|')) {
      const parts = callbackData.split('|');
      const compUserId = parts[1];
      const compCourseId = parts[2];
      const userId = decompressUuid(compUserId);
      const courseId = decompressUuid(compCourseId);

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('fullName').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('title').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      // Save pending prompt state for this chatId
      savePendingCustomDatePrompt(chatId, compUserId, compCourseId);

      await answerCallbackQuery(callbackQueryId, 'Ready for date');
      await sendTelegramReply(
        chatId,
        `✍️ <b>Custom Enrollment Date</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHtml(userRes.data?.fullName || 'Student')}\n` +
        `📚 <b>Course:</b> ${escapeHtml(courseRes.data?.title || 'Course')}\n\n` +
        `Please reply or type the custom start date below.\n\n` +
        `<b>Accepted Formats:</b>\n` +
        `• <code>DD-MM-YYYY</code> (e.g. <code>15-08-2026</code>)\n` +
        `• <code>DD/MM/YYYY</code> (e.g. <code>15/08/2026</code>)\n` +
        `• <code>YYYY-MM-DD</code> (e.g. <code>2026-08-15</code>)\n` +
        `• Relative: <code>today</code>, <code>yesterday</code>, <code>10 days ago</code>\n\n` +
        `<code>[Context: amcd|${compUserId}|${compCourseId}]</code>`,
        {
          force_reply: true,
          input_field_placeholder: 'DD-MM-YYYY (e.g. 15-08-2026)',
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown callback acknowledge
    await answerCallbackQuery(callbackQueryId, 'Action received.');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error?.message || error);
    if (globalCallbackQueryId) {
      await answerCallbackQuery(globalCallbackQueryId, 'Error: ' + (error?.message || 'Action failed.'));
    }
    if (currentChatId) {
      await sendTelegramReply(currentChatId, `⚠️ <b>Error processing action:</b> ${escapeHtml(error?.message || 'Operation failed. Please try again.')}`);
    }
    return NextResponse.json({ ok: true });
  }
}
