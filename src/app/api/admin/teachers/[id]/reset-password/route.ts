import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordResetEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        const bearerToken = extractBearerToken(request);
        const cookieToken = await extractCookieToken();
        const token = bearerToken || cookieToken;

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
        }

        const payload = verifyAuthToken(token);
        if (payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
        }

        const teacher = await prisma.user.findUnique({ where: { id: params.id } });
        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        const { token: resetToken, tokenHash } = createTokenPair();
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.user.update({
            where: { id: teacher.id },
            data: {
                passwordResetTokenHash: tokenHash,
                passwordResetExpires: resetExpiry,
            },
        });

        await sendPasswordResetEmail({
            email: teacher.email,
            fullName: teacher.fullName,
            token: resetToken,
        });

        return NextResponse.json({ 
            success: true, 
            message: `Password reset email dispatched to ${teacher.email}.` 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
