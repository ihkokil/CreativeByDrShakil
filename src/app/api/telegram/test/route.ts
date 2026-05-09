import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const host = request.headers.get('host') || '';
    const isLocalNonProd = process.env.NODE_ENV !== 'production' && host.startsWith('localhost');

    if (!isLocalNonProd) {
      const adminCheck = await requireAdmin(request);
      if (!adminCheck.ok) return adminCheck.response;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing Telegram env vars.',
          hasBotToken: Boolean(botToken),
          hasChatId: Boolean(chatId),
        },
        { status: 500 }
      );
    }

    const getMeRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const getMeData = await getMeRes.json();

    if (!getMeRes.ok || !getMeData?.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: 'getMe',
          telegram: getMeData,
          hasBotToken: true,
          hasChatId: true,
        },
        { status: 500 }
      );
    }

    const firstChatId = String(chatId).split(',').map((v) => v.trim()).filter(Boolean)[0];
    const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: firstChatId,
        text: 'Telegram integration test from CreativeByDrShakil API.',
      }),
    });
    const sendData = await sendRes.json();

    if (!sendRes.ok || !sendData?.ok) {
      return NextResponse.json(
        {
          ok: false,
          stage: 'sendMessage',
          telegram: sendData,
          firstChatId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      bot: getMeData?.result,
      message: sendData?.result,
      firstChatId,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Internal server error.',
      },
      { status: 500 }
    );
  }
}
