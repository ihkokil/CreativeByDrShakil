import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
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

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (user) {
      const { token, tokenHash } = createTokenPair();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry,
        },
      });

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
