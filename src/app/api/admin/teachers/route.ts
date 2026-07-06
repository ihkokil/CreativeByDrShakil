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

    const teachers = await db.query.user.findMany({
      where: (u, { eq }) => eq(u.role, 'teacher'),
      columns: {
        id: true,
        fullName: true,
        role: true,
        createdAt: true,
        email: true,
        designation: true,
        institution: true,
        degrees: true,
        profileImage: true,
        canManagePayments: true,
      },
      orderBy: (u, { desc }) => [desc(u.createdAt)],
    });

    return NextResponse.json({
      teachers: teachers.map((teacher: {
        id: string;
        fullName: string;
        role: string;
        createdAt: string;
        email: string;
        designation: string | null;
        institution: string | null;
        degrees: string | null;
        profileImage: string | null;
        canManagePayments: boolean;
      }) => ({
        id: teacher.id,
        full_name: teacher.fullName,
        role: teacher.role,
        created_at: teacher.createdAt,
        email: teacher.email,
        designation: teacher.designation,
        institution: teacher.institution,
        degrees: teacher.degrees,
        profile_image: teacher.profileImage,
        canManagePayments: teacher.canManagePayments,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
