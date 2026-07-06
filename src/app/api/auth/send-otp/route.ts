import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { eq, and, or, inArray, desc, asc, isNull, isNotNull, not, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from '@/lib/db';
import { sendOtpEmail } from '@/lib/auth-emails';

const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});

function hashOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Limit to 5 OTP requests per minute per IP
    const rateLimitError = await checkRateLimit(request, 5);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const userExists = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
      columns: { id: true }
    });

    if (userExists) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    // Delete any old OTPs for this email to clean up
    await db.delete(schema.emailOtps).where(eq(schema.emailOtps.email, normalizedEmail));

    // Store in DB
    await db.insert(schema.emailOtps).values({
      email: normalizedEmail,
      otpHash,
      expiresAt: expiresAt,
    });

    // Send the email
    await sendOtpEmail({
      email: normalizedEmail,
      otp,
    });

    return NextResponse.json({ success: true, message: 'Verification code sent to your email.' });
  } catch (error: any) {
    console.error('[Send OTP Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
