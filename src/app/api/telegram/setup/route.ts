import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getAppUrl } from '@/lib/email';

/**
 * POST /api/telegram/setup
 * One-time call to register the Telegram webhook using APP_URL from .env.
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) return adminCheck.response;

  const rawToken = process.env.TELEGRAM_BOT_TOKEN;
  const botToken = rawToken ? rawToken.replace(/^['"]|['"]$/g, '').replace(/['"]/g, '').trim() : '';
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN is not set in .env.local' }, { status: 500 });
  }

  const appUrl = getAppUrl();
  const webhookUrl = `${appUrl}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: 'Failed to set webhook', details: data }, { status: 500 });
  }

  return NextResponse.json({ success: true, webhookUrl, telegram: data });
}
