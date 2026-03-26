import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import bcrypt from 'bcryptjs';

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

    const passwordHash = await bcrypt.hash(password, 10);

    const student = await prisma.user.create({
        data: {
            email,
            fullName,
            phone,
            passwordHash,
            role: 'student',
            emailVerified: true, // Auto-verify internally added students
        }
    });

    return NextResponse.json({ message: 'Student created successfully.', student }, { status: 201 });
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
