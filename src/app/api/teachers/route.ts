import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getSupabaseAdmin } from '@/lib/db';

const normalizeOptionalText = (value: unknown) =>
  typeof value === 'string' ? value.trim() || null : null;

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data: teachers, error } = await supabase
      .from('User')
      .select('id, fullName, profileImage, designation, institution')
      .eq('role', 'teacher')
      .order('fullName', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      teachers: (teachers || []).map((teacher: any) => ({
        id: teacher.id,
        full_name: teacher.fullName?.trim() || null,
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
    console.error('[/api/teachers] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}