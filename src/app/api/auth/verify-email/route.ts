import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userSchema } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashToken } from "@/lib/token-utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
    }

    const tokenHash = await hashToken(token);

    const user = await db.query.user.findFirst({
      where: (u, { eq, and, gt }) => and(
        eq(u.emailVerificationTokenHash, tokenHash),
        gt(u.emailVerificationExpires, new Date().toISOString())
      ),
    });

    if (!user) {
      return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
    }

    await db.update(userSchema)
      .set({
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpires: null,
      })
      .where(eq(userSchema.id, user.id));

    return NextResponse.json({ success: true, message: "Email verified successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
