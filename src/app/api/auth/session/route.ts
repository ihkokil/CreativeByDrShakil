import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/db';

export async function GET(request: NextRequest) {
  const bearerToken = extractBearerToken(request);
  const cookieToken = await extractCookieToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return NextResponse.json({ user: null, role: null }, { status: 200 });
  }

  let payload;
  try {
    payload = await verifyAuthToken(token);
  } catch {
    // Token is expired or invalid — treat as unauthenticated, not a server error
    const cookieStore = await import('next/headers').then(m => m.cookies());
    cookieStore.delete(AUTH_COOKIE_NAME);
    return NextResponse.json({ user: null, role: null }, { status: 200 });
  }

  if (payload.sessionId) {
    const { isSessionValid } = await import('@/lib/session-manager');
    const xDeviceHash = request.headers.get('x-device-hash');
    const sessionValid = await isSessionValid(payload.sessionId, payload.sub, xDeviceHash);
    if (!sessionValid) {
      // Session has been revoked or logged out
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.delete(AUTH_COOKIE_NAME);
      return NextResponse.json({ user: null, role: null }, { status: 200 });
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: userRecord, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error || !userRecord || userRecord.isBanned) {
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.delete(AUTH_COOKIE_NAME);
      return NextResponse.json({ user: null, role: null }, { status: 200 });
    }

    if (payload.sessionId) {
      const { updateSessionActivity } = await import('@/lib/session-manager');
      await updateSessionActivity(payload.sessionId);
    }

    let finalToken = token;
    const xDeviceHash = request.headers.get('x-device-hash');

    if (xDeviceHash && payload.deviceHash !== xDeviceHash) {
      // Upgrade the JWT to contain the real device hash
      const { signAuthToken } = await import('@/lib/auth-server');
      const { sub, role, email, sessionId, isBanned, isSessionLockedExempt, user_metadata } = payload;
      
      finalToken = await signAuthToken({
        sub: sub as string,
        role: role as 'admin' | 'teacher' | 'student',
        email: email as string,
        sessionId: sessionId as string | undefined,
        isBanned: isBanned as boolean | undefined,
        isSessionLockedExempt: isSessionLockedExempt as boolean | undefined,
        user_metadata,
        deviceHash: xDeviceHash
      });
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.set(AUTH_COOKIE_NAME, finalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    return NextResponse.json({
      user: {
        id: userRecord.id,
        email: userRecord.email,
        phone: userRecord.phone || null,
        role: userRecord.role,
        user_metadata: {
          full_name: userRecord.fullName || null,
          phone: userRecord.phone || null,
          bmdc_number: userRecord.bmdcNumber || null,
          profile_image: userRecord.profileImage || null,
          canManagePayments: userRecord.canManagePayments || false,
        },
      },
      role: userRecord.role,
      token: finalToken,
      sessionId: payload.sessionId,
    });
  } catch (error) {
    console.error('[/api/auth/session] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to validate session.' },
      { status: 500 }
    );
  }
}
