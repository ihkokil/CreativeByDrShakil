import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server'

async function requireAdmin(request: NextRequest) {
  const bearerToken = extractBearerToken(request)
  const cookieToken = await extractCookieToken()
  const token = bearerToken || cookieToken

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  const payload = await verifyAuthToken(token)
  if (payload.role !== 'admin') {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }) }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const config = await db.query.paymentConfigs.findFirst({
      where: eq(schema.paymentConfigs.id, 'default'),
      columns: {
        provider: true,
        sendMoneyNumber: true,
        qrCodeUrl: true,
      },
    });

    return NextResponse.json({
      provider: config?.provider || 'bkash',
      sendMoneyNumber: config?.sendMoneyNumber || '01700000000',
      qrCodeUrl: config?.qrCodeUrl || '/bkash-qr.png',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request)
    if (!adminCheck.ok) return adminCheck.response

    const body = await request.json()
    const sendMoneyNumber = String(body?.sendMoneyNumber || '').trim()
    const qrCodeUrlRaw = String(body?.qrCodeUrl || '').trim()

    if (!sendMoneyNumber) {
      return NextResponse.json({ error: 'Send money number is required.' }, { status: 400 })
    }

    const qrCodeUrl = qrCodeUrlRaw || '/bkash-qr.png'

    await db.insert(schema.paymentConfigs).values({
      id: 'default',
      provider: 'bkash',
      sendMoneyNumber,
      qrCodeUrl,
    }).onDuplicateKeyUpdate({
      set: {
        provider: 'bkash',
        sendMoneyNumber,
        qrCodeUrl,
      }
    });

    const config = {
      id: 'default',
      provider: 'bkash',
      sendMoneyNumber,
      qrCodeUrl,
    };

    return NextResponse.json({ success: true, config })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 })
  }
}
