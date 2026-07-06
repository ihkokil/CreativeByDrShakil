import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
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

    const students = await db.query.user.findMany({
      where: (u, { eq }) => eq(u.role, 'student'),
      columns: {
        id: true,
        fullName: true,
        role: true,
        createdAt: true,
        email: true,
        phone: true,
        profileImage: true,
        bmdcNumber: true,
        emailVerified: true,
      },
      orderBy: (u, { desc }) => [desc(u.createdAt)],
      limit: 50, // limit for UI performance, can add pagination later
    });

    return NextResponse.json({
      students: students.map((student: any) => ({
        id: student.id,
        full_name: student.fullName,
        role: student.role,
        created_at: student.createdAt,
        email: student.email,
        phone: student.phone,
        profile_image: student.profileImage,
        bmdcNumber: student.bmdcNumber,
            emailVerified: student.emailVerified,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
