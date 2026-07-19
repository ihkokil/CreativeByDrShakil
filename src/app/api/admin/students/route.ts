import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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

    const supabase = getSupabaseAdmin();
    const { data: students = [], error } = await supabase
      .from('User')
      .select('id, fullName, role, createdAt, email, phone, profileImage, bmdcNumber, emailVerified')
      .eq('role', 'student')
      .order('createdAt', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      students: (students || []).map((student: any) => ({
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
