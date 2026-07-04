import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
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

    const user = await db.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    // Use queryRaw for pgcrypto
    await db.$queryRaw`
      UPDATE "User"
      SET 
        "passwordHash" = crypt(${String(password)}, gen_salt('bf', 12)),
        "passwordResetTokenHash" = NULL,
        "passwordResetExpires" = NULL,
        "updatedAt" = NOW()
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true, message: "Password reset successful. Please login." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
