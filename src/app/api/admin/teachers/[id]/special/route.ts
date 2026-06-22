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

    const [updatedTeacher] = await db.update(userSchema)
      .set({ canManagePayments })
      .where(and(eq(userSchema.id, params.id), eq(userSchema.role, 'teacher')))
      .returning({
        id: userSchema.id,
        fullName: userSchema.fullName,
        email: userSchema.email,
        role: userSchema.role,
        canManagePayments: userSchema.canManagePayments,
      });

    if (!updatedTeacher) {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
