import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendVerificationEmail } from '@/lib/auth-emails';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().optional().nullable(),
  bmdc: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
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

    const { email, password, fullName, phone, bmdc, role } = parsed.data;

    if (role && role !== 'student') {
      return NextResponse.json({ error: 'Only student accounts can be created through public registration.' }, { status: 403 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, ...(phone ? [{ phone }] : [])],
      },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists with this email or phone.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const { token, tokenHash } = createTokenPair();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName,
        phone: phone || null,
        bmdcNumber: bmdc || null,
        role: 'student',
        emailVerified: false,
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: verifyExpiry,
      },
    });

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
    // Handle Prisma unique constraint violation
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      if (target?.includes('email')) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
      }
      if (target?.includes('phone')) {
        return NextResponse.json({ error: 'An account with this phone number already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'An account with these details already exists.' }, { status: 409 });
    }
    console.error('[Register Error]', error?.message || error);
    console.error('[Register Stack]', error?.stack);
    return NextResponse.json({ error: 'Something went wrong. Please try again later.' }, { status: 500 });
  }
}
