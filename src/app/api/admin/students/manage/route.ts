import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken, hashPassword } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

// Add a new student
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
    const { email, fullName, phone, password } = body;

    // Minimal validation
    if (!email || !fullName || !password) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }
    });

    if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
    }

    // Create password reset token for the new student
    const { token: setupToken, tokenHash: resetTokenHash } = createTokenPair();
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const passwordHash = await hashPassword(password);

    const student = await prisma.user.create({
        data: {
            email,
            fullName,
            phone,
            passwordHash,
            role: 'student',
            emailVerified: true, // Auto-verify internally added students
            passwordResetTokenHash: resetTokenHash,
            passwordResetExpires: resetExpiry,
        }
    });

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
        student 
    }, { status: 201 });
  } catch (error: any) {
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
        const { id, fullName, phone } = body;
    
        if (!id) return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    
        const updated = await prisma.user.update({
            where: { id },
            data: { fullName, phone }
        });
    
        return NextResponse.json({ message: 'Student updated.', student: updated });
    } catch (err: any) {
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
