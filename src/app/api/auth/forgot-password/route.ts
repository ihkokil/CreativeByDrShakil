import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { user as userSchema } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTokenPair } from "@/lib/token-utils";
import { sendPasswordResetEmail } from "@/lib/auth-emails";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

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

    if (user) {
      const { token, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(userSchema)
        .set({
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
        })
        .where(eq(userSchema.id, user.id));

      try {
        await sendPasswordResetEmail({
          email: user.email,
          fullName: user.fullName,
          token,
        });
      } catch {
        // Keep response generic to avoid account and transport detail leakage.
      }
    }

    return NextResponse.json({
      success: true,
      message: "If the account exists, a password reset email has been sent.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
