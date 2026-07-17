import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
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
    if (payload.role !== 'admin' && payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: courses = [], error } = await supabase
      .from('Course')
      .select('id, title, slug, status, price, instructor')
      .order('updatedAt', { ascending: false })
      .order('createdAt', { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      courses: (courses || []).map((course: any) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        price: course.price,
        instructor: course.instructor,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
