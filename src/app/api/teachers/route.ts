import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';

const normalizeOptionalText = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

export async function GET() {
  try {
    const teachers = await db.query.user.findMany({
      where: (u, { eq }) => eq(u.role, 'teacher'),
      columns: {
        id: true,
        fullName: true,
        profileImage: true,
        designation: true,
        institution: true,
      },
      orderBy: (u, { asc }) => [asc(u.fullName)],
    });

    return NextResponse.json({
      teachers: teachers.map((teacher) => ({
        id: teacher.id,
        full_name: teacher.fullName.trim(),
        profile_image: normalizeOptionalText(teacher.profileImage),
        designation: normalizeOptionalText(teacher.designation),
        institution: normalizeOptionalText(teacher.institution),
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}