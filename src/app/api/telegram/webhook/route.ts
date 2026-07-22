import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { decompressUuid, compressUuid } from '@/lib/telegram';
import { ensureCourseEnrollment } from '@/lib/enrollment';

function getTelegramToken() {
  return process.env.TELEGRAM_BOT_TOKEN?.replace(/"/g, '');
}

function escapeHtml(value: string) {
  if (!value) return '';
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const token = getTelegramToken();
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text || 'Processing...',
      }),
    });
  } catch (err) {
    console.error('[Telegram Webhook] answerCallbackQuery error:', err);
  }
}

async function sendTelegramReply(chatId: string | number, text: string, replyMarkup?: any) {
  const token = getTelegramToken();
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error('[Telegram Webhook] sendMessage error:', err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callbackQuery = body?.callback_query;

    if (!callbackQuery) {
      const message = body?.message;
      if (message && message.text) {
        const text = message.text.trim();
        const chatId = message.chat.id;

        if (text === '/start' || text === '/help') {
          await sendTelegramReply(chatId, `Hello! 👋\n\nYour Telegram Chat ID is: <code>${chatId}</code>\n\nYou can use this ID in your environment variables to receive notifications.`);
        } else if (text === '/chatid') {
          await sendTelegramReply(chatId, `Your Chat ID: <code>${chatId}</code>`);
        } else if (text.startsWith('/student')) {
          const query = text.replace(/^\/student(@\w+)?\s*/i, '').trim();

          if (!query) {
            await sendTelegramReply(
              chatId,
              `ℹ️ <b>Student Lookup Usage:</b>\n<code>/student &lt;email, phone, or name&gt;</code>\n\n<b>Example:</b>\n<code>/student ihkokil@gmail.com</code>`
            );
          } else {
            const supabase = getSupabaseAdmin();
            const { data: matchedUsers } = await supabase
              .from('User')
              .select('id, fullName, email, phone, role, createdAt')
              .or(`email.ilike.%${query}%,phone.ilike.%${query}%,fullName.ilike.%${query}%`)
              .limit(5);

            if (!matchedUsers || matchedUsers.length === 0) {
              await sendTelegramReply(chatId, `❌ <b>No student found</b> matching "<code>${escapeHtml(query)}</code>".`);
            } else {
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
                      { text: '📚 Enroll in Course', callback_data: `en:${compressUuid(user.id)}` },
                      { text: '⚙️ Module Availability', callback_data: `av:${compressUuid(user.id)}` }
                    ]
                  ]
                };

                await sendTelegramReply(chatId, replyText, keyboard);
              }
            }
          }
        } else {
          // Acknowledge other commands/messages quietly
          await sendTelegramReply(chatId, `Command received: ${text}\nYour Chat ID: <code>${chatId}</code>`);
        }
      }
      return NextResponse.json({ ok: true });
    }

    const callbackData = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;
    const callbackQueryId = callbackQuery.id;

    if (!callbackData || !chatId) {
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabaseAdmin();

    // Handle "en:{compressedUserId}" — Show course list for enrollment
    if (callbackData.startsWith('en:')) {
      const compressedId = callbackData.slice(3);
      const userId = decompressUuid(compressedId);

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

      // Build course selection keyboard
      const keyboard = (courses || []).map((c: any) => ([{
        text: `📚 ${c.title}`,
        callback_data: `enroll:${compressedId}:${c.id}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select a course');
      await sendTelegramReply(
        chatId,
        `<b>Enroll ${user.fullName}</b>\n\nSelect a course to enroll this student in:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "enroll:{compressedUserId}:{courseId}" — Execute enrollment
    if (callbackData.startsWith('enroll:')) {
      const parts = callbackData.split(':');
      if (parts.length < 3) {
        await answerCallbackQuery(callbackQueryId, 'Invalid enrollment data.');
        return NextResponse.json({ ok: true });
      }

      const compressedUserId = parts[1];
      const courseId = parts.slice(2).join(':'); // courseId may contain colons (unlikely but safe)
      const userId = decompressUuid(compressedUserId);

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title, slug').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;

      if (!user || !course) {
        await answerCallbackQuery(callbackQueryId, 'User or course not found.');
        return NextResponse.json({ ok: true });
      }

      // Check for existing enrollment
      const { data: existingOrder }: { data: any } = await supabase
        .from('Order')
        .select('id')
        .eq('userId', userId)
        .eq('courseId', courseId)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (existingOrder) {
        await answerCallbackQuery(callbackQueryId, 'Already enrolled!');
        await sendTelegramReply(
          chatId,
          `⚠️ <b>${user.fullName}</b> is already enrolled in <b>${course.title}</b>.`
        );
        return NextResponse.json({ ok: true });
      }

      try {
        await ensureCourseEnrollment(null, userId, courseId, course.title, course.slug, true);
        await answerCallbackQuery(callbackQueryId, '✅ Enrolled!');
        await sendTelegramReply(
          chatId,
          `✅ <b>Enrollment Successful</b>\n\n👤 <b>Student:</b> ${user.fullName}\n📚 <b>Course:</b> ${course.title}`
        );
      } catch (enrollErr: any) {
        console.error('[Telegram Webhook] Enrollment failed:', enrollErr);
        await answerCallbackQuery(callbackQueryId, 'Enrollment failed.');
        await sendTelegramReply(chatId, `❌ Failed to enroll ${user.fullName}: ${enrollErr.message}`);
      }

      return NextResponse.json({ ok: true });
    }

    // Handle "av:{compressedUserId}" — Show module availability info
    if (callbackData.startsWith('av:')) {
      const compressedId = callbackData.slice(3);
      const userId = decompressUuid(compressedId);

      const { data: user }: { data: any } = await supabase
        .from('User')
        .select('id, fullName')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();

      if (!user) {
        await answerCallbackQuery(callbackQueryId, 'User not found.');
        return NextResponse.json({ ok: true });
      }

      // Get the student's enrolled courses
      const { data: orders = [] } = await supabase
        .from('Order')
        .select('courseId')
        .eq('userId', userId)
        .eq('status', 'approved');

      const courseIds = [...new Set((orders || []).map((o: any) => o.courseId).filter(Boolean))];

      if (courseIds.length === 0) {
        await answerCallbackQuery(callbackQueryId, 'No enrolled courses.');
        await sendTelegramReply(chatId, `⚠️ <b>${user.fullName}</b> has no enrolled courses.`);
        return NextResponse.json({ ok: true });
      }

      const { data: courses = [] } = await supabase
        .from('Course')
        .select('id, title')
        .in('id', courseIds);

      const { getAppUrl } = await import('@/lib/email');
      const appUrl = getAppUrl();

      const keyboard = (courses || []).map((c: any) => ([{
        text: `⚙️ ${c.title}`,
        url: `${appUrl}/admin/students/${userId}/courses/${c.id}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select a course');
      await sendTelegramReply(
        chatId,
        `<b>Module Availability for ${user.fullName}</b>\n\nSelect a course to manage:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Unknown callback — just acknowledge
    await answerCallbackQuery(callbackQueryId, 'Unknown action.');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error?.message || error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}
