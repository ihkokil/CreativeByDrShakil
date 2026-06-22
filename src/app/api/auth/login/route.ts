import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { user } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { comparePassword, signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { parseUserAgent, extractClientIp } from '@/lib/device-detection';
import {
  createDeviceSession,
  getActiveSessionsByDeviceType,
  terminateActiveSessionsByDeviceType,
  getAutoLockSetting,
} from '@/lib/session-manager';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Identifier is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 5);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: (parsed.error as any).errors[0].message }, { status: 400 });
    }

    const { identifier, password } = parsed.data;

    const userRecord = await db.query.user.findFirst({
      where: (u, { eq, or }) => or(eq(u.email, identifier), eq(u.phone, identifier)),
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (userRecord.isBanned) {
      return NextResponse.json(
        { error: 'You have been banned from this site. Please contact the administrator.' },
        { status: 403 }
      );
    }

    // Check email verification BEFORE password so unverified users
    // always see the verification message instead of "Invalid credentials"
    if (!userRecord.emailVerified) {
      return NextResponse.json(
        {
          error: 'Your email has not been verified yet. Please check your inbox and verify your email before logging in.',
          code: 'email_not_verified',
          email: userRecord.email,
        },
        { status: 403 }
      );
    }

    if (!userRecord.passwordHash) {
      return NextResponse.json(
        { error: 'This account is linked to Google. Please use "Continue with Google" to log in.' },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, userRecord.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Device detection
    const userAgent = request.headers.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);
    const ipAddress = extractClientIp(request.headers);

    // Check for existing sessions on the same device type
    const activeSessionsSameDevice = await getActiveSessionsByDeviceType(userRecord.id, deviceInfo.deviceType);

    // handle existing session logic
    const isSessionRestrictionExempt = userRecord.role === 'admin' || userRecord.role === 'teacher';

    if (activeSessionsSameDevice.length > 0 && !isSessionRestrictionExempt) {
      // Get Lock First Browser setting for the user
      const autoLockEnabled = await getAutoLockSetting(userRecord.id);

      if (autoLockEnabled) {
        // Lock is ON - reject the login request
        return NextResponse.json(
          {
            error: 'You are already logged in on another browser on this device. Please log out from the previous session or ask admin to log you out.',
            code: 'device_already_logged_in',
            sessionId: activeSessionsSameDevice[0].id,
          },
          { status: 409 }
        );
      } else {
        // Lock is OFF - terminate all old same-device sessions and allow new login
        await terminateActiveSessionsByDeviceType(userRecord.id, deviceInfo.deviceType);
      }
    }

    // Create new device session
    const newSession = await createDeviceSession({
      userId: userRecord.id,
      deviceType: deviceInfo.deviceType,
      browserName: deviceInfo.browserName,
      userAgent,
      ipAddress,
    });

    // Sign token with session ID
    const token = await signAuthToken({
      sub: userRecord.id,
      role: userRecord.role as 'admin' | 'teacher' | 'student',
      email: userRecord.email,
      sessionId: newSession.id,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: userRecord.id,
        email: userRecord.email,
        phone: userRecord.phone,
        role: userRecord.role,
        user_metadata: {
          full_name: userRecord.fullName,
          phone: userRecord.phone,
          bmdc_number: userRecord.bmdcNumber,
          profile_image: userRecord.profileImage,
        },
      },
      token,
      sessionId: newSession.id,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('[Login Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
