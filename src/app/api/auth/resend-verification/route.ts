import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createTokenPair } from "@/lib/token-utils";
import { sendVerificationEmail } from "@/lib/auth-emails";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (user && !user.emailVerified) {
      const { token, tokenHash } = await createTokenPair();
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: verifyExpiry,
        }
      });

      try {
        await sendVerificationEmail({
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
      message: "If the account exists and is unverified, a new verification email has been sent.",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
