import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

// Add a new student via invitation
export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    if (payload.role !== 'admin' && payload.role !== 'teacher') {
        return NextResponse.json({ error: 'Forbidden: Privileged access required.' }, { status: 403 });
    }

    const { fullName, email, phone, bmdcNumber, profileImage } = await request.json();

    if (!fullName || !email) {
        return NextResponse.json({ error: 'Full name and email are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await db.user.findFirst({
        where: {
            OR: [
                { email: normalizedEmail },
                ...(phone ? [{ phone }] : [])
            ]
        }
    });

    if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
    }

    // Create a placeholder password (unusable — student sets their own via reset link)
    const placeholder = `Invite${Date.now()}${Math.random().toString(36).slice(2)}!`;

    // Generate a password-reset token good for 72 hours
    const { token: setupToken, tokenHash: resetTokenHash } = await createTokenPair();
    const resetExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const insertResult = await db.$queryRaw<any[]>`
        INSERT INTO "User" (
            "id", "email", "fullName", "phone", "bmdcNumber", "profileImage", "passwordHash", "role",
            "emailVerified", "passwordResetTokenHash", "passwordResetExpires", "updatedAt"
        ) VALUES (
            ${crypto.randomUUID()}, ${normalizedEmail}, ${fullName}, ${phone || null}, ${bmdcNumber || null}, ${profileImage || null},
            crypt(${placeholder}, gen_salt('bf', 12)), 'student', true, ${resetTokenHash}, ${resetExpiry.toISOString()}, NOW()
        ) RETURNING *;
    `;
    const student = insertResult[0];

    // Send password setup email
    let emailSent = true;
    try {
        await sendPasswordSetupEmail({
            email: student.email,
            fullName: student.fullName,
            token: setupToken,
        });
    } catch (emailError) {
        console.error('Failed to send password setup email:', emailError);
        emailSent = false;
    }

    return NextResponse.json({ 
        message: emailSent 
            ? 'Student created successfully. A password setup email has been sent.' 
            : 'Student created successfully, but password setup email could not be sent.',
        student,
        emailSent
    }, { status: 201 });
  } catch (error: any) {
    console.error('[Create Student Error]', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// Update a student
export async function PUT(request: NextRequest) {
    try {
        const bearerToken = extractBearerToken(request);
        const cookieToken = await extractCookieToken();
        const token = bearerToken || cookieToken;
    
        if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    
        const payload = await verifyAuthToken(token);
        if (payload.role !== 'admin' && payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 });
    
        const body = await request.json();
        const { id, fullName, phone, bmdcNumber, profileImage, emailVerified } = body;
    
        if (!id) return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    
        const data: Record<string, unknown> = {
            fullName,
            phone: phone || null,
            bmdcNumber: bmdcNumber || null,
            profileImage: profileImage || null,
        };

        if (typeof emailVerified === 'boolean') {
            data.emailVerified = emailVerified;
            if (emailVerified) {
                data.emailVerificationTokenHash = null;
                data.emailVerificationExpires = null;
            }
        }

        const updated = await db.user.update({
            where: { id },
            data
        });
    
        return NextResponse.json({ message: 'Student updated successfully.', student: updated });
    } catch (err: any) {
        console.error('[Update Student Error]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// Delete a student
export async function DELETE(request: NextRequest) {
    try {
        const bearerToken = extractBearerToken(request);
        const cookieToken = await extractCookieToken();
        const token = bearerToken || cookieToken;
    
        if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    
        const payload = await verifyAuthToken(token);
        if (payload.role !== 'admin' && payload.role !== 'teacher') return NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 });
    
        const body = await request.json();
        const { id } = body;
    
        if (!id) return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    
        await db.user.delete({ where: { id } });
    
        return NextResponse.json({ message: 'Student deleted successfully.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
