import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTokenPair } from "@/lib/token-utils";
import { sendPasswordResetEmail } from "@/lib/auth-emails";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

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
