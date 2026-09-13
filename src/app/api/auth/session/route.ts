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
    const { checkSessionValidity } = await import('@/lib/session-manager');
    const xDeviceHash = request.headers.get('x-device-hash');
    const sessionResult = await checkSessionValidity(payload.sessionId, payload.sub, xDeviceHash);

    if (sessionResult.status === 'error') {
      // Transient database/network error: Return 500 so the client keeps current authenticated state
      return NextResponse.json(
        { error: 'Transient database error verifying session.' },
        { status: 500 }
      );
    }

    if (sessionResult.status === 'revoked') {
      // Session has been explicitly revoked or logged out in the database
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.delete(AUTH_COOKIE_NAME);
      return NextResponse.json({ user: null, role: null, code: 'session_revoked' }, { status: 200 });
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: userRecord, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error) {
      console.error('[/api/auth/session] DB error fetching user record:', error);
      return NextResponse.json(
        { error: 'Transient database error retrieving user profile.' },
        { status: 500 }
      );
    }

    if (!userRecord || userRecord.isBanned) {
      const cookieStore = await import('next/headers').then(m => m.cookies());
      cookieStore.delete(AUTH_COOKIE_NAME);
      return NextResponse.json({ user: null, role: null }, { status: 200 });
    }

    if (payload.sessionId) {
      const { updateSessionActivity } = await import('@/lib/session-manager');
      await updateSessionActivity(payload.sessionId).catch(() => {});
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
