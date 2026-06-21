import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { terminateSession } from '@/lib/session-manager';

export async function POST(request: NextRequest) {
  try {
    // Terminate the session if sessionId is provided
    const body = await request.json().catch(() => ({}));
    if (body.sessionId) {
      await terminateSession(body.sessionId);
    } else {
      // Try to get sessionId from token
      const token = await extractCookieToken();
      if (token) {
        try {
          const payload = await verifyAuthToken(token);
          if (payload.sessionId) {
            await terminateSession(payload.sessionId);
          }
        } catch {
          // Token verification failed, continue with logout
        }
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    // Still logout even if there's an error
    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
