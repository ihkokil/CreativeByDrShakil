import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { eq, and, or, inArray, desc, asc, isNull, isNotNull, not, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-utils";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
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

    const { token, password } = parsed.data;

    const tokenHash = await hashToken(String(token));

    const user = await db.query.users.findFirst({
      where: and(
        eq(schema.users.passwordResetTokenHash, tokenHash),
        sql`${schema.users.passwordResetExpires} > NOW()`
      ),
    });

    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    const { hash } = await import('bcryptjs');
    const newHash = await hash(String(password), 10);
    await db.update(schema.users).set({
      passwordHash: newHash,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      updatedAt: new Date()
    }).where(eq(schema.users.id, user.id));

    return NextResponse.json({ success: true, message: "Password reset successful. Please login." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
