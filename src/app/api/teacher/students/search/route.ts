import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql, ilike } from 'drizzle-orm';
import * as schema from '@/db/schema';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    
    const conditions = [eq(schema.users.role, 'student')];
    if (query.length > 0) {
      const searchPattern = `%${query}%`;
      conditions.push(
        or(
          ilike(schema.users.fullName, searchPattern),
          ilike(schema.users.email, searchPattern),
          ilike(schema.users.phone, searchPattern)
        )!
      );
    }

    const students = await db.query.users.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      limit: 200
    });

    return NextResponse.json({ students });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
