import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { extractCookieToken, verifyAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
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

    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    
    return NextResponse.json({ success: true });
  } catch {
    // Still logout even if there's an error
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
    return NextResponse.json({ success: true });
  }
}
