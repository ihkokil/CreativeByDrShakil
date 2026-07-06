import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { db } from '@/lib/db';

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
    // We are skipping `getSessionById` and `updateSessionActivity` to save 
    // Cloudflare Edge CPU and DB writes on every request. 
    // This makes the JWT purely stateless. Session termination will only apply on login/logout.
    
    // Fetch the latest profile image from the database to support base64 images 
    // that are excluded from the JWT token to prevent cookie size overflow.
    const userRecord = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, payload.sub),
      columns: {
        profileImage: true,
      },
    });

    const profileImage = userRecord?.profileImage || payload.user_metadata?.profile_image || null;

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
          profile_image: profileImage,
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
