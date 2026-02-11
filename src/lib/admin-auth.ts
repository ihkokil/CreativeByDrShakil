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