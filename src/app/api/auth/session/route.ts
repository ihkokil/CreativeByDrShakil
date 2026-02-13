import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { isSessionValid, updateSessionActivity } from '@/lib/session-manager';

export async function GET(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ user: null, role: null }, { status: 200 });
    }

    const payload = verifyAuthToken(token);

    // Check if session is still valid (not locked or logged out)
    if (payload.sessionId) {
      const sessionValid = await isSessionValid(payload.sessionId);
      if (!sessionValid) {
        return NextResponse.json(
          {
            user: null,
            role: null,
            code: 'session_revoked',
            message: 'Your session was terminated from another device.',
          },
          { status: 401 }
        );
      }

      // Update last activity
      await updateSessionActivity(payload.sessionId);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
        bmdcNumber: true,
        profileImage: true,
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
        },
      },
      role: user.role,
      token,
      sessionId: payload.sessionId,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to validate session.' },
      { status: 500 }
    );
  }
}
