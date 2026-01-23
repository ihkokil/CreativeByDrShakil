import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendVerificationEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, phone, bmdc, role } = await request.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Email, password, and full name are required.' }, { status: 400 });
    }

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
    } catch {
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
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
