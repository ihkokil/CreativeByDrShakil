import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, inArray, desc, asc, isNull, isNotNull, not, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-utils";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Missing verification token." }, { status: 400 });
    }

    const tokenHash = await hashToken(token);

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.emailVerificationTokenHash, tokenHash),
        sql`${schema.users.emailVerificationExpires} > NOW()`
      ),
    });

    if (!user) {
      return NextResponse.json({ error: "Verification link is invalid or expired." }, { status: 400 });
    }

    await db.update(schema.users).set({
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
    }).where(eq(schema.users.id, user.id));

    return NextResponse.json({ success: true, message: "Email verified successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
