import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { user as userSchema, emailOtp } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/lib/auth-server";
import { parseUserAgent, extractClientIp } from "@/lib/device-detection";
import { createDeviceSession } from "@/lib/session-manager";

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 5);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: (parsed.error as any).errors[0].message }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if the user exists
    const userRecord = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, normalizedEmail),
    });

    if (!userRecord) {
      return NextResponse.json({ error: "No account found with this email address." }, { status: 400 });
    }

    // Verify they completed OTP verification first
    const otpRecord = await db.query.emailOtp.findFirst({
      where: (e, { eq, and, gt }) => and(
        eq(e.email, normalizedEmail),
        eq(e.verified, true),
        gt(e.expiresAt, new Date().toISOString())
      ),
    });

    if (!otpRecord) {
      return NextResponse.json({ error: "OTP has not been verified or has expired. Please try again." }, { status: 400 });
    }

    // Update password
    const { hash } = await import('bcryptjs');
    const hashedPassword = await hash(String(password), 12);
    await db.update(userSchema)
      .set({
        passwordHash: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      })
      .where(eq(userSchema.id, userRecord.id));

    // Delete the verified OTP record to clean up and prevent reuse
    await db.delete(emailOtp).where(eq(emailOtp.id, otpRecord.id));

    // Auto-login logic
    const userAgent = request.headers.get("user-agent") || "";
    const ipAddress = extractClientIp(request.headers);

    const headerHash = request.headers.get("x-device-hash");
    const headerLabel = request.headers.get("x-device-label");
    const headerOS = request.headers.get("x-device-os");
    const headerCategory = request.headers.get("x-device-category") as "mobile" | "tablet" | "desktop" | null;

    const { getDeviceCategory, getDeviceLabel, detectOS } = await import("@/lib/client-fingerprint");

    const deviceType = headerCategory || getDeviceCategory(userAgent, 0, 1024, 768);
    const osInfo = headerOS || detectOS(userAgent);
    const baseDeviceLabel = headerLabel || getDeviceLabel(userAgent, deviceType);
    const fallbackHash = "fallback-" + Buffer.from(userAgent + osInfo + baseDeviceLabel).toString("base64").slice(0, 16);
    const deviceHash = headerHash || fallbackHash;

    const deviceInfo = parseUserAgent(userAgent);

    // Retrieve or set custom label
    const existingSessionWithLabel = await db.query.deviceSession.findFirst({
      where: (ds, { eq, and, isNotNull }) => and(
        eq(ds.userId, userRecord.id),
        eq(ds.deviceHash, deviceHash),
        isNotNull(ds.deviceLabel)
      ),
      orderBy: (ds, { desc }) => [desc(ds.createdAt)],
    });
    const deviceLabel = existingSessionWithLabel?.deviceLabel || baseDeviceLabel;

    // Create device session
    const newSession = await createDeviceSession({
      userId: userRecord.id,
      deviceType,
      browserName: deviceInfo.browserName,
      userAgent,
      ipAddress,
      deviceHash,
      deviceLabel,
      osInfo,
    });

    const safeProfileImage = userRecord.profileImage && userRecord.profileImage.length > 500
      ? null
      : userRecord.profileImage;

    const token = await signAuthToken({
      sub: userRecord.id,
      role: userRecord.role as "admin" | "teacher" | "student",
      email: userRecord.email,
      sessionId: newSession.id,
      user_metadata: {
        full_name: userRecord.fullName,
        phone: userRecord.phone,
        bmdc_number: userRecord.bmdcNumber,
        profile_image: safeProfileImage,
        canManagePayments: userRecord.canManagePayments,
      },
    });

    const response = NextResponse.json({
      success: true,
      message: "Password reset and logged in successfully!",
      user: {
        id: userRecord.id,
        email: userRecord.email,
        phone: userRecord.phone,
        role: userRecord.role,
        user_metadata: {
          full_name: userRecord.fullName,
          phone: userRecord.phone,
          bmdc_number: userRecord.bmdcNumber,
          profile_image: userRecord.profileImage,
        },
      },
      token,
      sessionId: newSession.id,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error("[Reset Password Error]", error?.message || error);
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
