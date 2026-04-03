import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken, hashPassword } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordResetEmail } from '@/lib/auth-emails';

// Add a new student via invitation
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { email, fullName, phone, bmdcNumber, profileImage } = body;

    if (!email || !fullName) {
        return NextResponse.json({ error: 'Email and Full Name are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: normalizedEmail }, ...(phone ? [{ phone }] : [])] }
    });

    if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
    }

    // Create a placeholder password (unusable — student sets their own via reset link)
    const placeholder = `Invite${Date.now()}${Math.random().toString(36).slice(2)}!`;
    const passwordHash = await hashPassword(placeholder);

    // Generate a password-reset token good for 72 hours
    const { token: resetToken, tokenHash } = createTokenPair();
    const resetExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const student = await prisma.user.create({
        data: {
            email: normalizedEmail,
            fullName,
            phone: phone || null,
            bmdcNumber: bmdcNumber || null,
            profileImage: profileImage || null,
            passwordHash,
            role: 'student',
            emailVerified: true,
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: resetExpiry,
        }
    });

    // Send the invitation email
    let emailSent = false;
    try {
        await sendPasswordResetEmail({
            email: normalizedEmail,
            fullName,
            token: resetToken,
        });
        emailSent = true;
    } catch (emailError: any) {
        console.error('[Invite Student Email Error]', emailError?.message || emailError);
    }

    return NextResponse.json({ 
        message: emailSent 
            ? `Student ${fullName} created and invitation sent.` 
            : `Student ${fullName} created, but email failed.`, 
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
    
        const payload = verifyAuthToken(token);
        if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
        const body = await request.json();
        const { id, fullName, phone, bmdcNumber, profileImage } = body;
    
        if (!id) return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    
        const updated = await prisma.user.update({
            where: { id },
            data: { 
                fullName, 
                phone: phone || null,
                bmdcNumber: bmdcNumber || null,
                profileImage: profileImage || null
            }
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
    
        const payload = verifyAuthToken(token);
        if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    
        const body = await request.json();
        const { id } = body;
    
        if (!id) return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    
        await prisma.user.delete({ where: { id } });
    
        return NextResponse.json({ message: 'Student deleted successfully.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
