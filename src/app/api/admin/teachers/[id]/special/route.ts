import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const updatedTeacher = await prisma.user.update({
      where: { id: params.id, role: 'teacher' },
      data: {
        canManagePayments,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        canManagePayments: true,
      }
    });

    return NextResponse.json({ success: true, teacher: updatedTeacher });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
