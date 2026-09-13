import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { updateSessionActivity, checkSessionValidity } from '@/lib/session-manager';

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyAuthToken(token);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
    }

    if (payload.isBanned) {
      return NextResponse.json({
        ok: false,
        code: 'user_banned',
        error: 'You have been banned from accessing the platform. Please contact Dr. Nahid Akhter Shakil or email support@creativebydrshakil.com.',
      }, { status: 403 });
    }

    if (payload.sessionId) {
      const xDeviceHash = request.headers.get('x-device-hash');
      const result = await checkSessionValidity(payload.sessionId, payload.sub, xDeviceHash);
      
      if (result.status === 'error') {
        // Transient database error: return 500 so heartbeat skips this ping without terminating session
        return NextResponse.json({ ok: false, error: 'Transient database error' }, { status: 500 });
      }

      if (result.status === 'revoked') {
        return NextResponse.json({
          ok: false,
          code: 'session_revoked',
          error: 'Session has been invalidated or expired.',
        }, { status: 401 });
      }

      await updateSessionActivity(payload.sessionId).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Internal error' }, { status: 500 });
  }
}
