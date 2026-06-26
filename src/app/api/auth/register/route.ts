import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { user as userSchema, emailOtp } from '@/db/schema';
import { eq, or, and, gt } from 'drizzle-orm';
import { hashPassword, signAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendVerificationEmail } from '@/lib/auth-emails';
import { parseUserAgent, extractClientIp } from '@/lib/device-detection';
import { createDeviceSession } from '@/lib/session-manager';
import { sendTelegramRegistrationNotification } from '@/lib/telegram';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().nullable(),
  bmdc: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  otpVerified: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 5);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const errorMessage = parsed.error?.issues?.[0]?.message || parsed.error?.message || 'Invalid input.';
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { email, password, fullName, phone, bmdc, role, otpVerified } = parsed.data;

    if (role && role !== 'student') {
      return NextResponse.json({ error: 'Only student accounts can be created through public registration.' }, { status: 403 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await db.query.user.findFirst({
      where: (u, { eq, or }) => or(eq(u.email, normalizedEmail), phone ? eq(u.phone, phone) : undefined),
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists with this email or phone.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    
    let emailVerified = false;
    let tokenHash = null;
    let verifyExpiry = null;
    let token = '';

    if (otpVerified) {
      const otpRecord = await db.query.emailOtp.findFirst({
        where: (e, { eq, and, gt }) => and(
          eq(e.email, normalizedEmail),
          eq(e.verified, true),
          gt(e.expiresAt, new Date().toISOString())
        ),
      });

      if (!otpRecord) {
        return NextResponse.json(
          { error: 'Email verification required or expired. Please verify your OTP code again.' },
          { status: 400 }
        );
      }

      emailVerified = true;
    } else {
      const tokenPair = await createTokenPair();
      token = tokenPair.token;
      tokenHash = tokenPair.tokenHash;
      verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const [user] = await db.insert(userSchema).values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash,
      fullName,
      phone: phone || null,
      bmdcNumber: bmdc || null,
      role: 'student',
      emailVerified,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: verifyExpiry?.toISOString() || null,
    }).returning();

    // Send Telegram Notification (fire and forget)
    sendTelegramRegistrationNotification({
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      phoneNumber: user.phone || undefined,
      createdAt: user.createdAt,
    }).catch(err => console.error('[Register] Telegram notification failed:', err));

    if (otpVerified) {
      // Clean up OTP record if verified via OTP
      await db.delete(emailOtp).where(eq(emailOtp.email, normalizedEmail));

      // Log the user in immediately
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
      const deviceLabel = headerLabel || getDeviceLabel(userAgent, deviceType);
      const fallbackHash = 'fallback-' + Buffer.from(userAgent + osInfo + deviceLabel).toString('base64').slice(0, 16);
      const deviceHash = headerHash || fallbackHash;

      const deviceInfo = parseUserAgent(userAgent);

      // Enforce allowed device type restrictions
      const { getGlobalSessionSettings } = await import('@/lib/session-manager');
      const globalSettings = await getGlobalSessionSettings();

      if (deviceType === 'desktop' && !globalSettings.allowDesktop) {
        return NextResponse.json({ error: 'Access from desktop devices is currently disabled.' }, { status: 403 });
      }
      if (deviceType === 'tablet' && !globalSettings.allowTablet) {
        return NextResponse.json({ error: 'Access from tablet devices is currently disabled.' }, { status: 403 });
      }
      if (deviceType === 'mobile' && !globalSettings.allowMobile) {
        return NextResponse.json({ error: 'Access from mobile devices is currently disabled.' }, { status: 403 });
      }

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

      const authToken = await signAuthToken({
        sub: user.id,
        role: user.role as 'admin' | 'teacher' | 'student',
        email: user.email,
        sessionId: newSession.id,
      });

      const response = NextResponse.json({
        success: true,
        requiresVerification: false,
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
        token: authToken,
        sessionId: newSession.id,
      });

      response.cookies.set(AUTH_COOKIE_NAME, authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }

    let verificationMailSent = true;
    try {
      await sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        token,
      });
    } catch (emailError: any) {
      console.error('[Register] Verification email failed:', emailError?.message || emailError);
      verificationMailSent = false;
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      message: verificationMailSent
        ? 'Account created. Please verify your email before logging in.'
        : 'Account created, but verification email could not be sent. Please use resend verification.',
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
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      const detail = error.detail || '';
      if (detail.includes('email')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      if (detail.includes('phone')) {
        return NextResponse.json({ error: 'An account with this phone number already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'An account with these details already exists.' }, { status: 409 });
    }
    console.error('[Register Error]', error?.message || error);
    return NextResponse.json({ error: 'Something went wrong. Please try again later.' }, { status: 500 });
  }
}
