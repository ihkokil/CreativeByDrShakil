import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
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

    // Check if it's actually a teacher
    const teacher = await db.query.users.findFirst({
        where: and(eq(schema.users.id, params.id), eq(schema.users.role, 'teacher'))
    });

    if (!teacher) {
        return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    await db.update(schema.users).set({ canManagePayments }).where(eq(schema.users.id, params.id));
    
    const updatedTeacher = await db.query.users.findFirst({
        where: eq(schema.users.id, params.id),
        columns: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            canManagePayments: true,
        }
    });

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
