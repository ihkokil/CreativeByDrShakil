import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

        const teacher = await prisma.user.findUnique({ where: { id: params.id } });
        if (!teacher) {
            return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
        }

        // Generate a mock reset token
        const resetToken = `reset-${Math.random().toString(36).substring(2, 15)}`;
        
        // In a real application, you would save this token to the database along with an expiration date
        // and then send an email containing a link with this token.
        
        console.log(`[MOCK EMAIL] To: ${teacher.email}`);
        console.log(`[MOCK EMAIL] Subject: Password Reset Request`);
        console.log(`[MOCK EMAIL] Body: Click the following link to reset your password: https://creativebds.com/reset-password?token=${resetToken}`);

        return NextResponse.json({ 
            success: true, 
            message: `Password reset email dispatched to ${teacher.email}.` 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
    }
}
