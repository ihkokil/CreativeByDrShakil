import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { emailOtp } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendForgotPasswordOtpEmail } from "@/lib/auth-emails";

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

    const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, normalizedEmail) });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email address." }, { status: 404 });
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Delete any old OTPs for this email to clean up
    await db.delete(emailOtp).where(eq(emailOtp.email, normalizedEmail));

    // Store in DB
    await db.insert(emailOtp).values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      otpHash,
      expiresAt: expiresAt.toISOString(),
    });

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
