import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { decompressUuid, compressUuid } from '@/lib/telegram';
import { ensureCourseEnrollment, ensureCustomBatch } from '@/lib/enrollment';

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
  let globalCallbackQueryId: string | undefined = undefined;
  try {
    const body = await request.json();
    const callbackQuery = body?.callback_query;
    if (callbackQuery?.id) {
      globalCallbackQueryId = callbackQuery.id;
    }

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
                      { text: '📚 Enroll in Course', callback_data: `en|${compressUuid(user.id)}` },
                      { text: '⚙️ Module Availability', callback_data: `av|${compressUuid(user.id)}` }
                    ]
                  ]
                };

                await sendTelegramReply(chatId, replyText, keyboard);
              }
            }
          }
        } else {
          // Check for ForceReply context for custom dates
          if (message.reply_to_message && message.reply_to_message.text && message.reply_to_message.text.includes('[Context: ed|')) {
            const contextMatch = message.reply_to_message.text.match(/\[Context: (ed\|[^\]]+)\]/);
            if (contextMatch) {
              const dateStr = text.trim();
              const dateParts = dateStr.split('-');
              let dateObj: Date;
              if (dateParts.length === 3) {
                dateObj = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`); // DD-MM-YYYY -> YYYY-MM-DD
              } else {
                dateObj = new Date(dateStr);
              }
              if (isNaN(dateObj.getTime())) {
                await sendTelegramReply(chatId, `❌ Invalid date format. Please use DD-MM-YYYY.`);
                return NextResponse.json({ ok: true });
              }
              const cbData = contextMatch[1].replace('ed', 'eo') + '|' + dateObj.toISOString().split('T')[0];
              await sendTelegramReply(chatId, `Confirm enrollment date <b>${dateStr}</b>?`, {
                inline_keyboard: [[{ text: '✅ Confirm Date', callback_data: cbData }]]
              });
              return NextResponse.json({ ok: true });
            }
          }
          await sendTelegramReply(chatId, `Command received: ${text}\nYour Chat ID: <code>${chatId}</code>`);
        }
      }
      return NextResponse.json({ ok: true });
    }

    let callbackData = callbackQuery.data as string;
    const chatId = callbackQuery.message?.chat?.id;
    const callbackQueryId = callbackQuery.id;

    if (!callbackData || !chatId) {
      return NextResponse.json({ ok: true });
    }

    // Support legacy callback query patterns from older registration notifications
    if (callbackData.startsWith('enroll_course_') || callbackData.startsWith('enroll|') || callbackData.startsWith('reg_enroll|')) {
      const parts = callbackData.includes('|') ? callbackData.split('|') : callbackData.split('_');
      const rawId = parts[parts.length - 1];
      callbackData = `en|${rawId.length === 36 ? compressUuid(rawId) : rawId}`;
    } else if (callbackData.startsWith('availability|') || callbackData.startsWith('reg_avail|')) {
      const parts = callbackData.includes('|') ? callbackData.split('|') : callbackData.split('_');
      const rawId = parts[parts.length - 1];
      callbackData = `av|${rawId.length === 36 ? compressUuid(rawId) : rawId}`;
    }

    const supabase = getSupabaseAdmin();

    // Handle "en|{compressedUserId}" — Show course list for enrollment
    if (callbackData.startsWith('en|')) {
      const compressedId = callbackData.split('|')[1];
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

      const keyboard = (courses || []).map((c: any) => ([{
        text: `📚 ${c.title}`,
        callback_data: `ec|${compressedId}|${compressUuid(c.id)}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select a course');
      await sendTelegramReply(
        chatId,
        `<b>Enroll ${user.fullName}</b>\n\nSelect a course to enroll this student in:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "ec|{compressedUserId}|{courseId}" — Show Batch list
    if (callbackData.startsWith('ec|')) {
      const parts = callbackData.split('|');
      const compressedId = parts[1];
      const courseId = decompressUuid(parts[2]);

      const { data: batches } = await (supabase.from('Batch') as any)
        .select('id, name')
        .eq('courseId', courseId)
        .order('startDate', { ascending: false })
        .limit(5);

      const keyboard: any[] = [];
      let hasCustomBatchInList = false;
      if (batches && batches.length > 0) {
        batches.forEach((b: any) => {
          if (b.name.toLowerCase().includes('custom')) {
            hasCustomBatchInList = true;
            keyboard.push([{ text: `📦 ${b.name} (Custom Date)`, callback_data: `ed|${compressedId}|b|${compressUuid(b.id)}` }]);
          } else {
            keyboard.push([{ text: `🗓 ${b.name}`, callback_data: `eb|${compressedId}|b|${compressUuid(b.id)}` }]);
          }
        });
      }
      if (!hasCustomBatchInList) {
        keyboard.push([{ text: `📦 Custom Batch (Custom Date)`, callback_data: `ed|${compressedId}|n|${compressUuid(courseId)}` }]);
      }

      await answerCallbackQuery(callbackQueryId, 'Select a batch');
      await sendTelegramReply(chatId, `Select a batch for this enrollment:`, { inline_keyboard: keyboard });
      return NextResponse.json({ ok: true });
    }

    // Handle "eb|{compressedUserId}|{type}|{id}" — Show Module Availability Options
    if (callbackData.startsWith('eb|')) {
      const parts = callbackData.split('|');
      const compressedId = parts[1];
      const type = parts[2];
      const id = parts[3];

      if (type === 'n') {
        // Custom batch selected -> ask for custom enrollment date
        await answerCallbackQuery(callbackQueryId);
        await sendTelegramReply(
          chatId,
          `Adding student to 📦 <b>Custom Batch</b>.\n\nPlease reply to this message with the custom enrollment date in <b>DD-MM-YYYY</b> format.\n\n<code>[Context: ed|${compressedId}|n|${id}]</code>`,
          {
            force_reply: true,
            input_field_placeholder: 'DD-MM-YYYY',
          }
        );
        return NextResponse.json({ ok: true });
      }

      const keyboard = [
        [{ text: `🗓 Current Batch (Default)`, callback_data: `eo|${compressedId}|${type}|${id}|current_batch` }],
        [{ text: `⚡ Instant Unlock`, callback_data: `eo|${compressedId}|${type}|${id}|instant` }],
        [{ text: `⏳ Fixed Interval`, callback_data: `eo|${compressedId}|${type}|${id}|fixed_interval` }],
        [{ text: `📦 Groups Per Week`, callback_data: `eo|${compressedId}|${type}|${id}|groups_per_week` }],
        [{ text: `📅 Day of Week`, callback_data: `eo|${compressedId}|${type}|${id}|day_of_week` }],
        [{ text: `📆 Custom Enrollment Date`, callback_data: `ed|${compressedId}|${type}|${id}` }],
      ];

      await answerCallbackQuery(callbackQueryId, 'Select availability mode');
      await sendTelegramReply(chatId, `How should the modules be available?`, { inline_keyboard: keyboard });
      return NextResponse.json({ ok: true });
    }

    // Handle "ed|{compressedUserId}|{type}|{id}" — Force Reply for custom date
    if (callbackData.startsWith('ed|')) {
      await answerCallbackQuery(callbackQueryId);
      await sendTelegramReply(
        chatId,
        `Please reply to this message with the custom enrollment date in <b>DD-MM-YYYY</b> format.\n\n<code>[Context: ${callbackData}]</code>`,
        {
          force_reply: true,
          input_field_placeholder: 'DD-MM-YYYY',
        }
      );
      return NextResponse.json({ ok: true });
    }

    // Handle "eo|{compressedUserId}|{type}|{id}|{modeOrDate}" — Execute enrollment or update
    if (callbackData.startsWith('eo|')) {
      const parts = callbackData.split('|');
      if (parts.length < 5) {
        await answerCallbackQuery(callbackQueryId, 'Invalid payload.');
        return NextResponse.json({ ok: true });
      }

      const compressedUserId = parts[1];
      const type = parts[2];
      const targetId = decompressUuid(parts[3]);
      const avail = parts[4];
      const userId = decompressUuid(compressedUserId);

      let courseId = type === 'b' ? '' : targetId;
      let batchId = type === 'b' ? targetId : null;

      if (type === 'b') {
        const { data: bData } = await (supabase.from('Batch') as any).select('courseId').eq('id', batchId).single();
        if (bData) courseId = bData.courseId;
      }

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

      const isExisting = Boolean(existingOrder);

      try {
        if (!existingOrder) {
          await ensureCourseEnrollment(null, userId, courseId, course.title, course.slug, true);
        }

        // Apply module availability settings
        if (avail === 'instant' || avail === 'all') {
          const { data: cData } = await supabase.from('Course').select('curriculumJson').eq('id', courseId).single();
          let nodes = [];
          try {
            nodes = typeof cData?.curriculumJson === 'string' ? JSON.parse(cData.curriculumJson) : (cData?.curriculumJson || []);
          } catch(e) {}
          
          const lessonNodeIds: string[] = [];
          const extractIds = (list: any[]) => {
            for (const n of list) {
              if (n.id) lessonNodeIds.push(n.id);
              if (n.children) extractIds(n.children);
            }
          };
          if (Array.isArray(nodes)) extractIds(nodes);

          const nowStr = new Date().toISOString();
          await supabase.from('StudentModuleAvailability').delete().eq('courseId', courseId).eq('userId', userId);
          if (lessonNodeIds.length > 0) {
            const inserts = lessonNodeIds.map(nodeId => ({
              id: crypto.randomUUID(),
              courseId,
              userId,
              lessonNodeId: nodeId,
              availabilityMode: 'available',
              availableAt: null,
              createdAt: nowStr,
              updatedAt: nowStr,
            }));
            await (supabase.from('StudentModuleAvailability') as any).insert(inserts as any);
          }
        } else if (['current_batch', 'fixed_interval', 'groups_per_week', 'day_of_week'].includes(avail)) {
          // Clear node-level overrides so scheduled availability applies
          await supabase.from('StudentModuleAvailability').delete().eq('courseId', courseId).eq('userId', userId);
        } else if (avail.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Custom enrollment date
          const customBatch = await ensureCustomBatch(supabase, courseId);

          await (supabase.from('Order') as any).update({
            enrolledAt: new Date(avail).toISOString(),
            batchId: customBatch.id,
          } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');

          await supabase.from('StudentModuleAvailability').delete().eq('courseId', courseId).eq('userId', userId);
        }

        // Update batch assignment if specified
        if (type === 'b' && batchId) {
          await (supabase.from('Order') as any).update({ batchId } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');
        } else if (type === 'n') {
          const customBatch = await ensureCustomBatch(supabase, courseId);
          await (supabase.from('Order') as any).update({ batchId: customBatch.id } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');
        }

        await answerCallbackQuery(callbackQueryId, isExisting ? '✅ Availability Updated!' : '✅ Enrolled!');
        await sendTelegramReply(
          chatId,
          `${isExisting ? '✅ <b>Module Availability Updated</b>' : '✅ <b>Enrollment Successful</b>'}\n\n👤 <b>Student:</b> ${user.fullName}\n📚 <b>Course:</b> ${course.title}${batchId ? '\n🗓 <b>Batch Updated</b>' : ''}\n⚙️ <b>Mode:</b> ${avail}`
        );
      } catch (enrollErr: any) {
        console.error('[Telegram Webhook] Enrollment error:', enrollErr);
        await answerCallbackQuery(callbackQueryId, 'Operation failed.');
        await sendTelegramReply(chatId, `❌ Failed to update ${user.fullName}: ${enrollErr.message}`);
      }

      return NextResponse.json({ ok: true });
    }

    // Handle "av|{compressedUserId}" — Show module availability info
    if (callbackData.startsWith('av|')) {
      const compressedId = callbackData.split('|')[1];
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

      const keyboard = (courses || []).map((c: any) => ([{
        text: `⚙️ ${c.title}`,
        callback_data: `avc|${compressedId}|${compressUuid(c.id)}`,
      }]));

      await answerCallbackQuery(callbackQueryId, 'Select a course');
      await sendTelegramReply(
        chatId,
        `<b>Module Availability for ${user.fullName}</b>\n\nSelect a course to manage:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "avc|{compressedUserId}|{courseId}" — Show 7 standardized options for enrolled course
    if (callbackData.startsWith('avc|')) {
      const parts = callbackData.split('|');
      const compressedId = parts[1];
      const courseId = decompressUuid(parts[2]);

      const keyboard = [
        [{ text: `🗓 Current Batch (Default)`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|current_batch` }],
        [{ text: `⚡ Instant Unlock`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|instant` }],
        [{ text: `⏳ Fixed Interval`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|fixed_interval` }],
        [{ text: `📦 Groups Per Week`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|groups_per_week` }],
        [{ text: `📅 Day of Week`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|day_of_week` }],
        [{ text: `🔀 Change Batch`, callback_data: `ec|${compressedId}|${compressUuid(courseId)}` }],
        [{ text: `📆 Custom Enrollment Date`, callback_data: `ed|${compressedId}|c|${compressUuid(courseId)}` }],
      ];

      await answerCallbackQuery(callbackQueryId, 'Select availability option');
      await sendTelegramReply(chatId, `Select Module Availability Option:`, { inline_keyboard: keyboard });
      return NextResponse.json({ ok: true });
    }

    // Unknown callback — just acknowledge
    await answerCallbackQuery(callbackQueryId, 'Action received.');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Webhook Error]', error?.message || error);
    if (globalCallbackQueryId) {
      await answerCallbackQuery(globalCallbackQueryId, 'An error occurred.');
    }
    return NextResponse.json({ ok: true });
  }
}
