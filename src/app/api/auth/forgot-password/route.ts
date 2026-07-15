import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabase } from "@/lib/db";
import { sendForgotPasswordOtpEmail } from "@/lib/auth-emails";
import { isPhoneNumber } from "@/lib/login-validator";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 5);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: (parsed.error as any).errors[0].message }, { status: 400 });
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    // Reject phone-number-like emails to protect Resend quota
    if (isPhoneNumber(normalizedEmail.split("@")[0])) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const supabase = getSupabase();
    
    // Find the user record
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: "No account found with this email address." }, { status: 404 });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Delete any old OTPs for this email to clean up
    const { error: deleteError } = await supabase
      .from('EmailOtp')
      .delete()
      .eq('email', normalizedEmail);

    if (deleteError) throw deleteError;

    // Store new OTP in DB
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
    await sendForgotPasswordOtpEmail({
      email: normalizedEmail,
      otp,
    });

    return NextResponse.json({
      success: true,
      message: "A 6-digit verification code has been sent to your email.",
    });
  } catch (error: any) {
    console.error("[Forgot Password OTP Error]", error?.message || error);
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
