import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: teacher, error }: { data: any; error: any } = await supabase
      .from('User')
      .select('id, fullName, email, role, canManagePayments, isSessionLockedExempt, designation, institution, degrees, profileImage')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return NextResponse.json({ error: 'User is not a teacher or admin.' }, { status: 400 });
    }

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        fullName: teacher.fullName,
        email: teacher.email,
        role: teacher.role,
        canManagePayments: teacher.canManagePayments || false,
        isSessionLockedExempt: teacher.isSessionLockedExempt || false,
        designation: teacher.designation || null,
        institution: teacher.institution || null,
        degrees: teacher.degrees || null,
        profileImage: teacher.profileImage || null,
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/teachers/[id]/special error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { data: teacher, error: fetchError }: { data: any; error: any } = await supabase
      .from('User')
      .select('id, role')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!teacher) {
      return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    }

    if (teacher.role !== 'teacher' && teacher.role !== 'admin') {
      return NextResponse.json({ error: 'User is not a teacher or admin.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.canManagePayments !== undefined) {
      updateData.canManagePayments = Boolean(body.canManagePayments);
    }
    if (body.isSessionLockedExempt !== undefined) {
      updateData.isSessionLockedExempt = Boolean(body.isSessionLockedExempt);
    }
    if (body.designation !== undefined) {
      updateData.designation = typeof body.designation === 'string' ? body.designation.trim() || null : null;
    }
    if (body.institution !== undefined) {
      updateData.institution = typeof body.institution === 'string' ? body.institution.trim() || null : null;
    }
    if (body.degrees !== undefined) {
      updateData.degrees = typeof body.degrees === 'string' ? body.degrees.trim() || null : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('User')
      // @ts-ignore: Supabase types expect never for update on untyped schema
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    const { data: updatedTeacher }: { data: any } = await supabase
      .from('User')
      .select('id, fullName, email, role, canManagePayments, isSessionLockedExempt, designation, institution, degrees, profileImage')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      teacher: updatedTeacher,
    });
  } catch (error: any) {
    console.error('PATCH /api/admin/teachers/[id]/special error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
