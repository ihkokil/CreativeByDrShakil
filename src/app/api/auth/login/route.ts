import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { comparePassword, signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { parseUserAgent, extractClientIp } from '@/lib/device-detection';
import {
  createDeviceSession,
  getActiveSessionsByDeviceType,
  terminateActiveSessionsByDeviceType,
  getAutoLockSetting,
} from '@/lib/session-manager';

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { phone: identifier }],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        {
          error: 'Please verify your email before logging in.',
          code: 'email_not_verified',
          email: user.email,
        },
        { status: 403 }
      );
    }

    // Device detection
    const userAgent = request.headers.get('user-agent') || '';
    const deviceInfo = parseUserAgent(userAgent);
    const ipAddress = extractClientIp(request.headers);

    // Check for existing sessions on the same device type
    const activeSessionsSameDevice = await getActiveSessionsByDeviceType(user.id, deviceInfo.deviceType);

    // handle existing session logic
    const isSessionRestrictionExempt = user.role === 'admin' || user.role === 'teacher';

    if (activeSessionsSameDevice.length > 0 && !isSessionRestrictionExempt) {
      // Get Lock First Browser setting for the user
      const autoLockEnabled = await getAutoLockSetting(user.id);

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
        await terminateActiveSessionsByDeviceType(user.id, deviceInfo.deviceType);
      }
    }

    // Create new device session
    const newSession = await createDeviceSession({
      userId: user.id,
      deviceType: deviceInfo.deviceType,
      browserName: deviceInfo.browserName,
      userAgent,
      ipAddress,
    });

    // Sign token with session ID
    const token = signAuthToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      sessionId: newSession.id,
    });

    const response = NextResponse.json({
      success: true,
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
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
