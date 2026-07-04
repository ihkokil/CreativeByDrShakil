import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { getCachedOrFetch } from '@/lib/kv-cache';

const normalizeOptionalText = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

// FREE TIER OPTIMIZATION: Cache teachers list to stay within 50ms CPU budget
export async function GET() {
  try {
    const cacheKey = 'teachers:list';

    return NextResponse.json(
      await getCachedOrFetch(
        { key: cacheKey, ttl: 3600 }, // Cache for 1 hour (teachers list rarely changes)
        async () => {
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

          return {
            teachers: teachers.map((teacher) => ({
              id: teacher.id,
              full_name: teacher.fullName.trim(),
              profile_image: normalizeOptionalText(teacher.profileImage),
              designation: normalizeOptionalText(teacher.designation),
              institution: normalizeOptionalText(teacher.institution),
            })),
          };
        }
      ),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}