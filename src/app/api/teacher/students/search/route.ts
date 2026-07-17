import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { getSupabase } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    const supabase = getSupabase();
    
    let dbQuery = supabase
      .from('User')
      .select('id, fullName, email, phone')
      .eq('role', 'student');

    if (query.length > 0) {
      const searchPattern = `%${query}%`;
      dbQuery = dbQuery.or(`fullName.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`);
    }

    const { data: students = [], error } = await dbQuery.limit(200);

    if (error) throw error;

    return NextResponse.json({ students: students || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
