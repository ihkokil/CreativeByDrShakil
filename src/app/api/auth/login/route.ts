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

    // Handle newly migrated users who don't have a password yet
    if (userRecord.passwordHash === 'MIGRATED_USER_NO_PASSWORD') {
      const { hash } = await import('bcrypt');
      const newHash = await hash(password, 10);
      await db.update(user).set({ passwordHash: newHash }).where(eq(user.id, userRecord.id));
      userRecord.passwordHash = newHash;
    }

    const isValid = await comparePassword(password, userRecord.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // Device detection
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = extractClientIp(request.headers);

    // Retrieve custom device headers (with fallbacks for backward compatibility)
    const headerHash = request.headers.get('x-device-hash');
    const headerLabel = request.headers.get('x-device-label');
    const headerOS = request.headers.get('x-device-os');
    const headerCategory = request.headers.get('x-device-category') as 'mobile' | 'tablet' | 'desktop' | null;

    const { getDeviceCategory, getDeviceLabel, detectOS } = await import('@/lib/client-fingerprint');
    
    const deviceType = headerCategory || getDeviceCategory(userAgent, 0, 1024, 768);
    const osInfo = headerOS || detectOS(userAgent);
    const baseDeviceLabel = headerLabel || getDeviceLabel(userAgent, deviceType);
    const fallbackHash = 'fallback-' + Buffer.from(userAgent + osInfo + baseDeviceLabel).toString('base64').slice(0, 16);
    const deviceHash = headerHash || fallbackHash;

    const deviceInfo = parseUserAgent(userAgent);

    // Fetch global settings
    const { getGlobalSessionSettings, getActiveSessionsForUser, terminateSession, lockSession } = await import('@/lib/session-manager');
    const globalSettings = await getGlobalSessionSettings();

    // Enforce allowed device type restrictions (students only — admins/teachers are exempt)
    const isPrivilegedRole = userRecord.role === 'admin' || userRecord.role === 'teacher';
    if (!isPrivilegedRole) {
      if (deviceType === 'desktop' && !globalSettings.allowDesktop) {
        return NextResponse.json({ error: 'Access from desktop devices is currently disabled.' }, { status: 403 });
      }
      if (deviceType === 'tablet' && !globalSettings.allowTablet) {
        return NextResponse.json({ error: 'Access from tablet devices is currently disabled.' }, { status: 403 });
      }
      if (deviceType === 'mobile' && !globalSettings.allowMobile) {
        return NextResponse.json({ error: 'Access from mobile devices is currently disabled.' }, { status: 403 });
      }
    }

    // Look for a custom device name previously saved for this device/browser hash
    const existingSessionWithLabel = await db.query.deviceSession.findFirst({
      where: (ds, { eq, and, isNotNull }) => and(
        eq(ds.userId, userRecord.id),
        eq(ds.deviceHash, deviceHash),
        isNotNull(ds.deviceLabel)
      ),
      orderBy: (ds, { desc }) => [desc(ds.createdAt)],
    });
    const deviceLabel = existingSessionWithLabel?.deviceLabel || baseDeviceLabel;

    // Check for existing active sessions
    const activeSessions = await getActiveSessionsForUser(userRecord.id);
    const isSessionRestrictionExempt = isPrivilegedRole || !!userRecord.isSessionLockedExempt;

    // Graceful browser switch on same device
    const existingActiveSameDevice = activeSessions.find(s => s.deviceHash === deviceHash);
    if (existingActiveSameDevice) {
      await terminateSession(existingActiveSameDevice.id);
      const index = activeSessions.findIndex(s => s.id === existingActiveSameDevice.id);
      if (index > -1) {
        activeSessions.splice(index, 1);
      }
    }

    // Enforce concurrent session limits
    if (!isSessionRestrictionExempt) {
      const limit = globalSettings.maxConcurrentSessions;
      if (activeSessions.length >= limit) {
        const numToLock = activeSessions.length - limit + 1;
        const sessionsToLock = activeSessions.slice(activeSessions.length - numToLock);
        for (const sessionToLock of sessionsToLock) {
          await lockSession(sessionToLock.id, deviceLabel);
        }
      }
    }

    // Create new device session
    const newSession = await createDeviceSession({
      userId: userRecord.id,
      deviceType,
      browserName: deviceInfo.browserName,
      userAgent,
      ipAddress,
      deviceHash,
      deviceLabel,
      osInfo,
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
