import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { getSessionById } from '@/lib/session-manager';

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
    return NextResponse.json({ user: null, role: null }, { status: 200 });
  }

  try {
    // Check if session is still valid (not locked or logged out)
    if (payload.sessionId) {
      const session = await getSessionById(payload.sessionId);
      if (!session || session.loggedOutAt || session.isLocked) {
        let message = 'Your session was terminated from another device.';
        
        if (session?.isLocked && session.lockedByDeviceLabel) {
          const oldLabel = session.deviceLabel || 'Unknown device';
          const typeLabel = session.deviceType === 'desktop' ? 'Desktop' : session.deviceType === 'tablet' ? 'Tablet' : 'Mobile';
          message = `Your session on ${oldLabel} was replaced by ${session.lockedByDeviceLabel} in the ${typeLabel} category.`;
        }

        return NextResponse.json(
          {
            user: null,
            role: null,
            code: 'session_revoked',
            message: message,
          },
          { status: 401 }
        );
      }

      // Skipping `updateSessionActivity` to save Cloudflare Edge CPU/DB writes on every request.
    }

    // Build the user response entirely from the JWT payload to avoid a DB read
    return NextResponse.json({
      user: {
        id: payload.sub,
        email: payload.email,
        phone: payload.user_metadata?.phone || null,
        role: payload.role,
        user_metadata: {
          full_name: payload.user_metadata?.full_name || null,
          phone: payload.user_metadata?.phone || null,
          bmdc_number: payload.user_metadata?.bmdc_number || null,
          profile_image: payload.user_metadata?.profile_image || null,
          canManagePayments: payload.user_metadata?.canManagePayments || false,
        },
      },
      role: payload.role,
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
