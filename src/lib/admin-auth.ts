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
    payload = await verifyAuthToken(token);
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

export async function requireTeacherOrAdmin(request: NextRequest) {
  const bearerToken = extractBearerToken(request);
  const cookieToken = await extractCookieToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  let payload: AuthTokenPayload;

  try {
    payload = await verifyAuthToken(token);
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  if (payload.role !== 'admin' && payload.role !== 'teacher') {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden: Teacher or Admin access required.' }, { status: 403 }),
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
    payload = await verifyAuthToken(token);
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  if (payload.role === 'admin') {
    return { ok: true as const, payload };
  }

  if (payload.role === 'teacher') {
    // Check database to see if the teacher has the canManagePayments flag
    const { getSupabaseAdmin } = await import('@/lib/db');
    const supabase = getSupabaseAdmin();
    const { data: user, error: userError }: { data: any, error: any } = await supabase
      .from('User')
      .select('canManagePayments')
      .eq('id', payload.sub)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (user?.canManagePayments) {
      return { ok: true as const, payload };
    }
  }

  return {
    ok: false as const,
    response: NextResponse.json({ error: 'Forbidden: Payment management access required.' }, { status: 403 }),
  };
}