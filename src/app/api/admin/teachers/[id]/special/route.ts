import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userSchema } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const params = await props.params;
    const { canManagePayments } = await request.json();

    if (typeof canManagePayments !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload. canManagePayments must be a boolean.' }, { status: 400 });
    }

    await db.update(userSchema)
      .set({ canManagePayments })
      .where(and(eq(userSchema.id, params.id), eq(userSchema.role, 'teacher')));

    const updatedTeacher = await db.query.user.findFirst({
      where: (u, { eq, and }) => and(eq(u.id, params.id), eq(u.role, 'teacher')),
      columns: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        canManagePayments: true,
      }
    });

    if (!updatedTeacher) {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
