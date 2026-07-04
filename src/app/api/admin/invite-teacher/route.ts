import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userSchema } from '@/db/schema';
import { sql } from 'drizzle-orm';
import {
    extractBearerToken,
    extractCookieToken,
    verifyAuthToken,
} from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordResetEmail } from '@/lib/auth-emails';


export async function POST(request: NextRequest) {
    try {
        const { fullName, email, designation, institution, degrees, profileImage } = await request.json();

        if (!fullName || !email) {
            return NextResponse.json(
                { error: 'Full name and email are required.' },
                { status: 400 }
            );
        }

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

        const normalizedEmail = email.trim().toLowerCase();

        const existingTeacher = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, normalizedEmail),
        });

        if (existingTeacher) {
            return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
        }

        // Create a placeholder password (unusable — teacher sets their own via reset link)
        const placeholder = `Invite${Date.now()}${Math.random().toString(36).slice(2)}!`;


        // Generate a password-reset token good for 72 hours (longer than normal resets)
        const { token: resetToken, tokenHash } = await createTokenPair();
        const resetExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

        await db.insert(userSchema).values({
            id: crypto.randomUUID(),
            email: normalizedEmail,
            fullName,
            passwordHash: sql`crypt(${placeholder}, gen_salt('bf', 12))`,
            role: 'teacher',
            designation: designation || null,
            institution: institution || null,
            degrees: degrees || null,
            profileImage: profileImage || null,
            emailVerified: true,
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: resetExpiry.toISOString(),
        });

        // Send the "Set Your Password" email using the existing reset-password template
        let emailSent = false;
        try {
            await sendPasswordResetEmail({
                email: normalizedEmail,
                fullName,
                token: resetToken,
            });
            emailSent = true;
        } catch (emailError: any) {
            console.error('[Invite Teacher Email Error]', emailError?.message || emailError);
        }

        return NextResponse.json({
            success: true,
            emailSent,
            message: emailSent
                ? `Teacher ${fullName} created. A password-setup email has been sent to ${normalizedEmail}.`
                : `Teacher ${fullName} created, but the email could not be sent. You can trigger a manual password reset from the admin panel.`,
        });
    } catch (err: any) {
        console.error('[Invite Teacher Error]', err?.message || err);
        return NextResponse.json(
            { error: 'Failed to create teacher.' },
            { status: 500 }
        );
    }
}
