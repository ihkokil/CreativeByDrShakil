import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-server";
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

    const tokenHash = hashToken(String(token));

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(String(password));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({ success: true, message: "Password reset successful. Please login." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error." }, { status: 500 });
  }
}
