import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userSchema } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createTokenPair } from "@/lib/token-utils";
import { sendVerificationEmail } from "@/lib/auth-emails";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, normalizedEmail) });

    if (user && !user.emailVerified) {
      const { token, tokenHash } = await createTokenPair();
      const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.update(userSchema)
        .set({
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpires: verifyExpiry.toISOString(),
        })
        .where(eq(userSchema.id, user.id));

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
