import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabaseAdmin } from '@/lib/db';
import { parseDbDate } from '@/lib/date-format';

const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().length(6, 'Verification code must be 6 digits'),
});

function hashOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // Limit verification attempts to 10 per minute per IP
    const rateLimitError = await checkRateLimit(request, 10);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, otp } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    const { data: otpRecord, error: otpError } = await supabase
      .from('EmailOtp')
      .select('*')
      .eq('email', normalizedEmail)
      .order('createdAt', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;

    if (!otpRecord) {
      return NextResponse.json({ error: 'No verification code found for this email.' }, { status: 400 });
    }

    const expiresAt = parseDbDate(otpRecord.expiresAt);
    if (expiresAt && expiresAt < new Date()) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    const expectedHash = hashOtp(otp);
    if (otpRecord.otpHash !== expectedHash) {
      return NextResponse.json({ error: 'Incorrect verification code. Please try again.' }, { status: 400 });
    }

    // Mark as verified so registration API can check it
    const { error: updateError } = await supabase
      .from('EmailOtp')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    if (updateError) throw updateError;

    return NextResponse.json({ verified: true, message: 'Email verified successfully.' });
  } catch (error: any) {
    console.error('[Verify OTP Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
