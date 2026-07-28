import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

import { signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { parseUserAgent, extractClientIp } from '@/lib/device-detection';
import {
  createDeviceSession,
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

function getAppUrl(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || origin;
}

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);

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

    const supabase = getSupabaseAdmin();

    // Step 3: Find or create user in database
    let { data: user } = await supabase
      .from('User')
      .select('*')
      .eq('email', googleUser.email)
      .limit(1)
      .maybeSingle();

    if (!user) {
      // Create new user
      const userId = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase
        .from('User')
        .insert({
          id: userId,
          email: googleUser.email,
          fullName: googleUser.name || 'Google User',
          emailVerified: true,
          profileImage: googleUser.picture || null,
          role: 'student',
          updatedAt: new Date().toISOString(),
        })
        .select()
        .single();
        
      if (createError) {
        console.error('[Google OAuth Callback] Create user error:', createError);
      }
      user = newUser;
    } else {
      // Update profile image from Google if not already set
      if (!user.profileImage && googleUser.picture) {
        const { data: updatedUser, error: updateError } = await supabase
          .from('User')
          .update({ profileImage: googleUser.picture })
          .eq('id', user.id)
          .select()
          .single();
          
        if (!updateError && updatedUser) {
          user = updatedUser;
        }
      }
    }

    if (!user) {
      return NextResponse.redirect(`${appUrl}/?auth=login&error=CreationFailed`);
    }

    if (user.isBanned) {
      return NextResponse.redirect(`${appUrl}/?auth=login&error=Banned`);
    }

    // Step 4: Device session management
    const userAgent = request.headers.get('user-agent') || '';
    const ipAddress = extractClientIp(request.headers);

    // Retrieve custom device headers
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
    const { getGlobalSessionSettings } = await import('@/lib/session-manager');
    const globalSettings = await getGlobalSessionSettings();

    // Enforce allowed device type restrictions (students only)
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

    const { data: existingSessionWithLabel, error: labelError } = await supabase
      .from('DeviceSession')
      .select('*')
      .eq('userId', user.id)
      .eq('deviceHash', deviceHash)
      .not('deviceLabel', 'is', null)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (labelError) throw labelError;

    const deviceLabel = existingSessionWithLabel?.deviceLabel || baseDeviceLabel;

    // Create new device session atomically via RPC
    let newSession;
    try {
      newSession = await createDeviceSession({
        userId: user.id,
        deviceType,
        browserName: deviceInfo.browserName,
        userAgent,
        ipAddress,
        deviceHash,
        deviceLabel,
        osInfo,
      });
    } catch (error: any) {
      if (error.message === 'device_category_locked') {
        const categoryName = deviceType === 'desktop' ? 'Desktop/Laptop' :
                             deviceType === 'tablet' ? 'Tablet' : 'Mobile';
        return NextResponse.redirect(`${appUrl}/?auth=login&error=${encodeURIComponent(`This account is already linked to a different ${categoryName.toLowerCase()} device. Only the original device in this category can log in.`)}`);
      }
      throw error;
    }

    const safeProfileImage = user.profileImage && user.profileImage.length > 500 
      ? null 
      : user.profileImage;

    // Step 5: Mint custom JWT and set cookie
    const token = await signAuthToken({
      sub: user.id,
      role: user.role as 'admin' | 'teacher' | 'student',
      email: user.email,
      sessionId: newSession.id,
      isBanned: user.isBanned || false,
      isSessionLockedExempt: !!user.isSessionLockedExempt,
      deviceHash,
      user_metadata: {
        full_name: user.fullName,
        phone: user.phone,
        bmdc_number: user.bmdcNumber,
        profile_image: safeProfileImage,
      },
    });

    const targetDashboard = user.role === 'admin'
      ? `${appUrl}/admin/dashboard`
      : user.role === 'teacher'
        ? `${appUrl}/teacher/dashboard`
        : `${appUrl}/dashboard/courses`;

    const response = NextResponse.redirect(targetDashboard);

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
