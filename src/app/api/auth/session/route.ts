import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { getSupabase } from '@/lib/db';

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
    const response = NextResponse.json({ user: null, role: null }, { status: 200 });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  if (payload.sessionId) {
    const { isSessionValid } = await import('@/lib/session-manager');
    const sessionValid = await isSessionValid(payload.sessionId);
    if (!sessionValid) {
      // Session has been revoked or logged out
      const response = NextResponse.json({ user: null, role: null }, { status: 200 });
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
  }

  try {
    const supabase = getSupabase();
    const { data: userRecord, error } = await supabase
      .from('User')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error || !userRecord || userRecord.isBanned) {
      const response = NextResponse.json({ user: null, role: null }, { status: 200 });
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }

    if (payload.sessionId) {
      const { updateSessionActivity } = await import('@/lib/session-manager');
      await updateSessionActivity(payload.sessionId);
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
      token,
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
