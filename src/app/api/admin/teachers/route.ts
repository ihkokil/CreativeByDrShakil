import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
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

    const teachers = await db.query.users.findMany({
      where: eq(schema.users.role, 'teacher'),
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
      orderBy: [desc(schema.users.createdAt)],
    });

    return NextResponse.json({
      teachers: teachers.map((teacher: any) => ({
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
