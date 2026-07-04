import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    
    const students = await db.user.findMany({
      where: {
        role: 'student',
        ...(query.length > 0 ? {
          OR: [
            { fullName: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } }
          ]
        } : {})
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      take: 200
    });

    return NextResponse.json({ students });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
