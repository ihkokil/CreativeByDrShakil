import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { getSessionById, updateSessionActivity } from '@/lib/session-manager';

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

      // Update last activity
      await updateSessionActivity(payload.sessionId);
    }

    const user = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, payload.sub),
      columns: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
        bmdcNumber: true,
        profileImage: true,
        canManagePayments: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null, role: null }, { status: 200 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        user_metadata: {
          full_name: user.fullName,
          phone: user.phone,
          bmdc_number: user.bmdcNumber,
          profile_image: user.profileImage,
          canManagePayments: user.canManagePayments,
        },
      },
      role: user.role,
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
