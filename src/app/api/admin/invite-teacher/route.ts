import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    extractBearerToken,
    extractCookieToken,
    hashPassword,
    verifyAuthToken,
} from '@/lib/auth-server';

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

        const payload = verifyAuthToken(token);
        if (payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
        }

        const existingTeacher = await prisma.user.findUnique({
            where: { email },
        });

        if (existingTeacher) {
            return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
        }

        // Temporary password should be rotated using a reset flow.
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        const passwordHash = await hashPassword(tempPassword);

        await prisma.user.create({
            data: {
                email,
                fullName,
                passwordHash,
                role: 'teacher',
                designation: designation || null,
                institution: institution || null,
                degrees: degrees || null,
                profileImage: profileImage || null,
            },
        });

        return NextResponse.json({
            success: true,
            message: `Teacher ${fullName} created successfully. Add password reset email workflow before production invite flow.`,
        });
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message || 'Internal server error.' },
            { status: 500 }
        );
    }
}
