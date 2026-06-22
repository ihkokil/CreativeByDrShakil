import { NextRequest, NextResponse } from 'next/server';
import { requireTeacherPayload } from '@/lib/route-auth';
import { db } from '@/lib/db';
import { user as userSchema } from '@/db/schema';
import { eq, or, and, ilike } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    
    const students = await db.query.user.findMany({
      where: (u, { eq, or, and, ilike }) => {
        const roleMatch = eq(u.role, 'student');
        if (query.length > 0) {
          const searchPattern = `%${query}%`;
          return and(
            roleMatch,
            or(
              ilike(u.fullName, searchPattern),
              ilike(u.email, searchPattern),
              ilike(u.phone, searchPattern)
            )
          );
        }
        return roleMatch;
      },
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
