import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken, type AuthTokenPayload } from '@/lib/auth-server';

export async function requireAdmin(request: NextRequest) {
  const bearerToken = extractBearerToken(request);
  const cookieToken = await extractCookieToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  let payload: AuthTokenPayload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  if (payload.role !== 'admin') {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }),
    };
  }

  return { ok: true as const, payload };
}

export async function requirePaymentManager(request: NextRequest) {
  const bearerToken = extractBearerToken(request);
  const cookieToken = await extractCookieToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  let payload: AuthTokenPayload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  if (payload.role === 'admin') {
    return { ok: true as const, payload };
  }

  if (payload.role === 'teacher') {
    // Check database to see if the teacher has the canManagePayments flag
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { canManagePayments: true }
    });

    if (user?.canManagePayments) {
      return { ok: true as const, payload };
    }
  }

  return {
    ok: false as const,
    response: NextResponse.json({ error: 'Forbidden: Payment management access required.' }, { status: 403 }),
  };
}