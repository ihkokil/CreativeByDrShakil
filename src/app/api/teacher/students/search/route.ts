import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    
    // Build where clause
    const whereClause: any = { role: 'student' };
    if (query.length > 0) {
      whereClause.OR = [
        { fullName: { contains: query } },
        { email: { contains: query } },
        { phone: { contains: query } },
      ];
    }

    const students = await prisma.user.findMany({
      where: whereClause,
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
