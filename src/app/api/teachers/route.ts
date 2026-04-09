import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

const normalizeOptionalText = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

export async function GET() {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'teacher' },
      select: {
        id: true,
        fullName: true,
        profileImage: true,
        designation: true,
        institution: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return NextResponse.json({
      teachers: teachers.map((teacher) => ({
        id: teacher.id,
        full_name: teacher.fullName.trim(),
        profile_image: normalizeOptionalText(teacher.profileImage),
        designation: normalizeOptionalText(teacher.designation),
        institution: normalizeOptionalText(teacher.institution),
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}