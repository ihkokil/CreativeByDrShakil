import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, isNotNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { parseUserAgent, extractClientIp } from '@/lib/device-detection';
import {
  createDeviceSession,
  getActiveSessionsByDeviceType,
  terminateActiveSessionsByDeviceType,
  getAutoLockSetting,
} from '@/lib/session-manager';

/**
 * Google OAuth Callback Handler
 * 
 * GET /api/auth/google-callback?code=... 
 * 
 * Exchanges the authorization code for tokens via fetch() (Workers-compatible),
 * fetches user info, creates/links the user in Prisma, mints a custom JWT,
 * and sets the session cookie.
 */

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

function getRequestOrigin(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  if (host) {
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const appUrl = getRequestOrigin(request);

  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Google OAuth Callback] Error from Google:', error);
      return NextResponse.redirect(`${appUrl}/?auth=login&error=OAuthDenied`);
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}/?auth=login&error=NoCode`);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${appUrl}/api/auth/google-callback`;

    if (!clientId || !clientSecret) {
      console.error('[Google OAuth Callback] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.redirect(`${appUrl}/?auth=login&error=OAuthConfig`);
    }

    // Step 1: Exchange authorization code for tokens via fetch()
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('[Google OAuth Callback] Token exchange failed:', tokenResponse.status, errorBody);
      return NextResponse.redirect(`${appUrl}/?auth=login&error=TokenExchangeFailed`);
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Step 2: Fetch user info via fetch()
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('[Google OAuth Callback] Failed to fetch user info:', userInfoResponse.status);
      return NextResponse.redirect(`${appUrl}/?auth=login&error=UserInfoFailed`);
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json();

    if (!googleUser.email) {
      return NextResponse.redirect(`${appUrl}/?auth=login&error=NoEmail`);
    }

    // Step 3: Find or create user in database
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, googleUser.email),
    });

    if (!user) {
      // Create new user
      await db.insert(schema.users).values({
        email: googleUser.email,
        fullName: googleUser.name || 'Google User',
        emailVerified: true, // Google emails are already verified
        profileImage: googleUser.picture || null,
        role: 'student',
      });
      user = (await db.query.users.findFirst({ where: eq(schema.users.email, googleUser.email) }))!;
    } else {
      // Update profile image from Google if not already set
      if (!user.profileImage && googleUser.picture) {
        await db.update(schema.users).set({ profileImage: googleUser.picture }).where(eq(schema.users.id, user.id));
      }
    }

    if (user.isBanned) {
      return NextResponse.redirect(`${appUrl}/?auth=login&error=Banned`);
    }

    // Step 4: Device session management
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
    const isPrivilegedRole = user.role === 'admin' || user.role === 'teacher';
    if (!isPrivilegedRole) {
      if (deviceType === 'desktop' && !globalSettings.allowDesktop) {
        return NextResponse.redirect(`${appUrl}/?auth=login&error=${encodeURIComponent('Access from desktop devices is currently disabled.')}`);
      }
      if (deviceType === 'tablet' && !globalSettings.allowTablet) {
        return NextResponse.redirect(`${appUrl}/?auth=login&error=${encodeURIComponent('Access from tablet devices is currently disabled.')}`);
      }
      if (deviceType === 'mobile' && !globalSettings.allowMobile) {
        return NextResponse.redirect(`${appUrl}/?auth=login&error=${encodeURIComponent('Access from mobile devices is currently disabled.')}`);
      }
    }

    // Look for a custom device name previously saved for this device/browser hash
    const existingSessionWithLabel = await db.query.deviceSessions.findFirst({
      where: and(
        eq(schema.deviceSessions.userId, user.id),
        eq(schema.deviceSessions.deviceHash, deviceHash),
        isNotNull(schema.deviceSessions.deviceLabel)
      ),
      orderBy: [desc(schema.deviceSessions.createdAt)],
    });
    const deviceLabel = existingSessionWithLabel?.deviceLabel || baseDeviceLabel;

    // Check for existing active sessions
    const activeSessions = await getActiveSessionsForUser(user.id);
    const isSessionRestrictionExempt = isPrivilegedRole || !!user.isSessionLockedExempt;

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
      userId: user.id,
      deviceType,
      browserName: deviceInfo.browserName,
      userAgent,
      ipAddress,
      deviceHash,
      deviceLabel,
      osInfo,
    });

    const safeProfileImage = user.profileImage && user.profileImage.length > 500 
      ? null 
      : user.profileImage;

    // Step 5: Mint custom JWT and set cookie
    const token = await signAuthToken({
      sub: user.id,
      role: user.role as 'admin' | 'teacher' | 'student',
      email: user.email,
      sessionId: newSession.id,
      user_metadata: {
        full_name: user.fullName,
        phone: user.phone,
        bmdc_number: user.bmdcNumber,
        profile_image: safeProfileImage,
      },
    });

    // Redirect to dashboard with the cookie set
    const response = NextResponse.redirect(`${appUrl}/dashboard`);

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('[Google OAuth Callback] Unexpected error:', error);
    return NextResponse.redirect(`${appUrl}/?auth=login&error=OAuthUnexpected`);
  }
}
