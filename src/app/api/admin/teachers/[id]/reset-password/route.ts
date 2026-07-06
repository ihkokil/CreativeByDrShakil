import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
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

        const payload = await verifyAuthToken(token);
        if (payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
        }

        const teacher = await db.query.users.findFirst({ where: eq(schema.users.id, params.id) });
        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        const { token: resetToken, tokenHash } = await createTokenPair();
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await db.update(schema.users).set({
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: resetExpiry,
        }).where(eq(schema.users.id, teacher.id));

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
