import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabase } from '@/lib/db';
import { sendOtpEmail } from '@/lib/auth-emails';
import { isPhoneNumber } from '@/lib/login-validator';

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

    // Reject phone-number-like emails to protect Resend quota
    if (isPhoneNumber(normalizedEmail.split("@")[0])) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if user already exists
    const { data: userExists, error: userError } = await supabase
      .from('User')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (userExists) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiry

    // Delete any old OTPs for this email to clean up
    const { error: deleteError } = await supabase
      .from('EmailOtp')
      .delete()
      .eq('email', normalizedEmail);

    if (deleteError) throw deleteError;

    // Store in DB
    const { error: insertError } = await supabase
      .from('EmailOtp')
      .insert({
        id: crypto.randomUUID(),
        email: normalizedEmail,
        otpHash,
        expiresAt: expiresAt.toISOString(),
      });

    if (insertError) throw insertError;

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
