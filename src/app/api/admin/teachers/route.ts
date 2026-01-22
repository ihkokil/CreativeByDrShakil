import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
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

    const teachers = await prisma.user.findMany({
      where: { role: 'teacher' },
      select: {
        id: true,
        fullName: true,
        role: true,
        createdAt: true,
        email: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      teachers: teachers.map((teacher: {
        id: string;
        fullName: string;
        role: string;
        createdAt: Date;
        email: string;
      }) => ({
        id: teacher.id,
        full_name: teacher.fullName,
        role: teacher.role,
        created_at: teacher.createdAt,
        email: teacher.email,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
