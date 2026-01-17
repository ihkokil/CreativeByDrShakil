import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth-server";
import { hashToken } from "@/lib/token-utils";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required." }, { status: 400 });
    }

    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

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
