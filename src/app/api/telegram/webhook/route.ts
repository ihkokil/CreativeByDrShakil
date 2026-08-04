import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { decompressUuid, compressUuid } from '@/lib/telegram';
import { ensureCourseEnrollment, ensureCustomBatch, ensureDefaultBatches } from '@/lib/enrollment';

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
  if (!token) {
    console.warn('[Telegram Webhook] TELEGRAM_BOT_TOKEN missing, cannot send reply');
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error('[Telegram Webhook] sendMessage failed:', res.status, errBody);
    }
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
              const rawDate = text.trim();
              let dateObj: Date | null = null;
              const dateParts = rawDate.split(/[-/.]/);
              if (dateParts.length === 3) {
                if (dateParts[0].length === 4) {
                  // YYYY-MM-DD
                  dateObj = new Date(`${dateParts[0]}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}T00:00:00.000Z`);
                } else {
                  // DD-MM-YYYY
                  dateObj = new Date(`${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}T00:00:00.000Z`);
                }
              } else {
                dateObj = new Date(rawDate);
              }
              if (!dateObj || isNaN(dateObj.getTime())) {
                await sendTelegramReply(chatId, `❌ Invalid date format. Please use <b>DD-MM-YYYY</b> format (e.g. 15-08-2026).`);
                return NextResponse.json({ ok: true });
              }
              const isoDate = dateObj.toISOString().split('T')[0];
              const cbData = contextMatch[1].replace('ed', 'eo') + '|' + isoDate;

              const parts = contextMatch[1].split('|');
              const uId = decompressUuid(parts[1]);
              const tId = decompressUuid(parts[3]);
              const [uRes, cRes] = await Promise.all([
                supabase.from('User').select('fullName').eq('id', uId).limit(1).maybeSingle(),
                supabase.from('Course').select('title').eq('id', tId).limit(1).maybeSingle(),
              ]);

              const uName = uRes.data?.fullName || 'Student';
              const cTitle = cRes.data?.title || 'Course';

              const confirmMsg = [
                '📆 <b>Confirm Custom Enrollment Date</b>',
                '',
                `👤 <b>Student:</b> ${escapeHtml(uName)}`,
                `📚 <b>Course:</b> ${escapeHtml(cTitle)}`,
                `📅 <b>Custom Date:</b> <code>${isoDate}</code>`,
                '',
                `Click below to confirm setting custom enrollment date to <b>${isoDate}</b>:`
              ].join('\n');

              await sendTelegramReply(chatId, confirmMsg, {
                inline_keyboard: [[{ text: '✅ Confirm Custom Date', callback_data: cbData }]]
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
        `<b>Enroll ${escapeHtml(user.fullName)}</b>\n\nSelect a course to enroll this student in:`,
        { inline_keyboard: keyboard }
      );

      return NextResponse.json({ ok: true });
    }

    // Handle "ec|{compressedUserId}|{courseId}" — Show Batch list
    if (callbackData.startsWith('ec|')) {
      const parts = callbackData.split('|');
      const compressedId = parts[1];
      const courseId = decompressUuid(parts[2]);

      const { data: course } = await (supabase.from('Course') as any)
        .select('id, title, releaseMode')
        .eq('id', courseId)
        .limit(1)
        .maybeSingle();

      const { customBatch, instantBatch } = await ensureDefaultBatches(supabase, courseId);
      const isCircular = course?.releaseMode === 'circular';

      const keyboard: any[] = [];

      // 1. Instant Batch
      keyboard.push([{ text: `⚡ Instant Batch`, callback_data: `eo|${compressedId}|b|${compressUuid(instantBatch.id)}|ins` }]);

      // 2. Up to 3 last created custom batches (if circular course)
      if (isCircular) {
        const { data: createdBatches } = await (supabase.from('Batch') as any)
          .select('id, name, createdAt')
          .eq('courseId', courseId)
          .not('name', 'ilike', 'Custom Batch')
          .not('name', 'ilike', 'Instant Batch')
          .order('createdAt', { ascending: false })
          .limit(3);

        if (createdBatches && createdBatches.length > 0) {
          createdBatches.forEach((b: any) => {
            keyboard.push([{ text: `🗓 ${b.name}`, callback_data: `eo|${compressedId}|b|${compressUuid(b.id)}|cur` }]);
          });
        }
      }

      // 3. Custom Batch
      keyboard.push([{ text: `📦 Custom Batch`, callback_data: `eo|${compressedId}|b|${compressUuid(customBatch.id)}|cur` }]);

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
        [{ text: `🗓 Current Batch (Default)`, callback_data: `eo|${compressedId}|${type}|${id}|cur` }],
        [{ text: `⚡ Instant Unlock`, callback_data: `eo|${compressedId}|${type}|${id}|ins` }],
        [{ text: `⏳ Fixed Interval`, callback_data: `eo|${compressedId}|${type}|${id}|fix` }],
        [{ text: `📦 Groups Per Week`, callback_data: `eo|${compressedId}|${type}|${id}|gpw` }],
        [{ text: `📅 Day of Week`, callback_data: `eo|${compressedId}|${type}|${id}|dow` }],
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
      const availRaw = parts[4];
      const userId = decompressUuid(compressedUserId);

      // Normalize short availability codes
      let avail = availRaw;
      if (availRaw === 'cur') avail = 'current_batch';
      else if (availRaw === 'ins') avail = 'instant';
      else if (availRaw === 'fix') avail = 'fixed_interval';
      else if (availRaw === 'gpw') avail = 'groups_per_week';
      else if (availRaw === 'dow') avail = 'day_of_week';

      let courseId = type === 'b' ? '' : targetId;
      let batchId = type === 'b' ? targetId : null;

      if (type === 'b' && batchId) {
        const { data: bData } = await (supabase.from('Batch') as any)
          .select('courseId')
          .eq('id', batchId)
          .limit(1)
          .maybeSingle();
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
        const customDateObj = avail.match(/^\d{4}-\d{2}-\d{2}$/)
          ? new Date(`${avail}T00:00:00.000Z`)
          : undefined;

        if (!existingOrder) {
          await ensureCourseEnrollment(null, userId, courseId, course.title, course.slug, true, customDateObj, undefined, batchId);
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
        } else if (customDateObj) {
          // Custom enrollment date
          const customBatch = await ensureCustomBatch(supabase, courseId);
          const customIso = customDateObj.toISOString();

          await (supabase.from('Order') as any).update({
            enrolledAt: customIso,
            batchId: customBatch.id,
            updatedAt: new Date().toISOString(),
          } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');

          await (supabase.from('User') as any).update({
            enrollmentDate: customIso,
          } as any).eq('id', userId);

          await supabase.from('StudentModuleAvailability').delete().eq('courseId', courseId).eq('userId', userId);
        }

        // Update batch assignment if specified
        if (type === 'b' && batchId) {
          await (supabase.from('Order') as any).update({ batchId } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');
        } else if (type === 'n' || customDateObj) {
          const customBatch = await ensureCustomBatch(supabase, courseId);
          await (supabase.from('Order') as any).update({ batchId: customBatch.id } as any).eq('userId', userId).eq('courseId', courseId).eq('status', 'approved');
        }

        const { data: batchData } = batchId 
          ? await (supabase.from('Batch') as any).select('name').eq('id', batchId).maybeSingle()
          : { data: null };
        const displayBatchName = batchData?.name || (avail === 'instant' ? 'Instant Batch' : 'Custom Batch');

        let modeLabel = 'Scheduled Release';
        let actionDesc = 'Modules will follow standard batch release timeline.';

        if (avail === 'instant' || avail === 'all') {
          modeLabel = '⚡ Instant Unlock';
          actionDesc = 'All course modules unlocked immediately for instant full access.';
        } else if (customDateObj) {
          modeLabel = '📆 Custom Enrollment Date';
          actionDesc = `Enrolled with custom start date <b>${avail}</b>. Module schedule calculates from this date.`;
        } else if (avail === 'fixed_interval') {
          modeLabel = '⏳ Fixed Interval';
          actionDesc = 'Modules unlock sequentially based on fixed interval schedule.';
        } else if (avail === 'groups_per_week') {
          modeLabel = '📦 Groups Per Week';
          actionDesc = 'Modules unlock according to weekly group release schedule.';
        } else if (avail === 'day_of_week') {
          modeLabel = '📅 Day of Week';
          actionDesc = 'Modules unlock on designated days of the week.';
        } else if (avail === 'current_batch') {
          modeLabel = '🗓 Current Batch';
          actionDesc = 'Student assigned to active batch timeline.';
        }

        const replyLines = [
          isExisting ? '✅ <b>Enrollment Updated Successfully</b>' : '✅ <b>Course Enrollment Successful</b>',
          '',
          `👤 <b>Student:</b> ${escapeHtml(user.fullName)} (<code>${escapeHtml(user.email)}</code>)`,
          `📚 <b>Course:</b> ${escapeHtml(course.title)}`,
          `🗓 <b>Batch:</b> ${escapeHtml(displayBatchName)}`,
          `⚙️ <b>Availability Mode:</b> ${modeLabel}`,
        ];

        if (customDateObj) {
          replyLines.push(`📅 <b>Enrollment Date:</b> <code>${avail}</code>`);
        }

        replyLines.push('', `📝 <b>Action Summary:</b>\n${actionDesc}`);

        await answerCallbackQuery(callbackQueryId, isExisting ? '✅ Enrollment Updated!' : '✅ Enrolled!');
        await sendTelegramReply(chatId, replyLines.join('\n'));
      } catch (enrollErr: any) {
        console.error('[Telegram Webhook] Enrollment error:', enrollErr);
        await answerCallbackQuery(callbackQueryId, 'Operation failed.');
        await sendTelegramReply(chatId, `❌ Failed to update ${escapeHtml(user.fullName)}: ${escapeHtml(enrollErr.message)}`);
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
        await sendTelegramReply(chatId, `⚠️ <b>${escapeHtml(user.fullName)}</b> has no enrolled courses.`);
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
        `<b>Module Availability for ${escapeHtml(user.fullName)}</b>\n\nSelect a course to manage:`,
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
        [{ text: `🗓 Current Batch (Default)`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|cur` }],
        [{ text: `⚡ Instant Unlock`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|ins` }],
        [{ text: `⏳ Fixed Interval`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|fix` }],
        [{ text: `📦 Groups Per Week`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|gpw` }],
        [{ text: `📅 Day of Week`, callback_data: `eo|${compressedId}|c|${compressUuid(courseId)}|dow` }],
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
