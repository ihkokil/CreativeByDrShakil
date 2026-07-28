import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherOrAdmin } from '@/lib/admin-auth';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { nanoid } from '@/lib/nanoid';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest) {
  try {
    const authCheck = await requireTeacherOrAdmin(request);
    if (!authCheck.ok) return authCheck.response;

    const body = await request.json();
    const { action } = body;

    const supabase = getSupabaseAdmin();

    if (action === 'enroll') {
      const { userId, courseId } = body;

      if (!userId || !courseId) {
        return NextResponse.json({ error: 'userId and courseId are required.' }, { status: 400 });
      }

      const [userRes, courseRes] = await Promise.all([
        supabase.from('User').select('id, fullName, email').eq('id', userId).limit(1).maybeSingle(),
        supabase.from('Course').select('id, title, slug').eq('id', courseId).limit(1).maybeSingle(),
      ]);

      const user = userRes.data as any;
      const course = courseRes.data as any;

      if (!user) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      if (!course) return NextResponse.json({ error: 'Course not found.' }, { status: 404 });

      await ensureCourseEnrollment(null, userId, courseId, course.title, course.slug, true);

      return NextResponse.json({
        success: true,
        message: `${user.fullName} enrolled in ${course.title}.`,
      });
    }

    if (action === 'create-and-enroll') {
      const { email, fullName, phone, courseId } = body;

      if (!email || !fullName) {
        return NextResponse.json({ error: 'email and fullName are required.' }, { status: 400 });
      }

      if (!body.batchId && !body.enrollmentDate) {
        return NextResponse.json({ error: 'Either batchId or enrollmentDate is required.' }, { status: 400 });
      }

      let userId: string;
      const { data: existingUser }: { data: any } = await supabase
        .from('User')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1)
        .maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        userId = nanoid();
        const nowStr = new Date().toISOString();

        const { error: insertError } = await supabase.from('User')
          // @ts-ignore
          .insert({
            id: userId,
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            phone: phone?.trim() || null,
            role: 'student',
            emailVerified: true,
            batchId: body.batchId || null,
            enrollmentDate: body.enrollmentDate ? new Date(body.enrollmentDate).toISOString() : null,
            createdAt: nowStr,
            updatedAt: nowStr,
          } as any);

        if (insertError) throw insertError;

        try {
          const { token: setupToken, tokenHash } = await createTokenPair();
          const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

          await supabase
            .from('User')
            // @ts-ignore
            .update({
              passwordResetTokenHash: tokenHash,
              passwordResetExpires: resetExpiry.toISOString(),
              updatedAt: new Date().toISOString(),
            })
            .eq('id', userId);

          await sendPasswordSetupEmail({
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            token: setupToken,
          });
        } catch (emailErr) {
          console.error('[admin/students/manage] Setup email failed:', emailErr);
        }
      }

      if (courseId) {
        const { data: course }: { data: any } = await supabase
          .from('Course')
          .select('id, title, slug')
          .eq('id', courseId)
          .limit(1)
          .maybeSingle();

        if (course) {
          await ensureCourseEnrollment(null, userId, courseId, course.title, course.slug, true);
        }
      }

      return NextResponse.json({
        success: true,
        userId,
        message: existingUser ? 'Existing student enrolled.' : 'New student created and enrolled.',
      });
    }

    if (action === 'update') {
      const targetUserId = body.userId || body.id;

      if (!targetUserId) {
        return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (body.fullName !== undefined) updateData.fullName = body.fullName?.trim() || null;
      if (body.email !== undefined) updateData.email = body.email?.trim().toLowerCase() || null;
      if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
      if (body.bmdcNumber !== undefined) updateData.bmdcNumber = body.bmdcNumber?.trim() || null;
      if (body.profileImage !== undefined) updateData.profileImage = body.profileImage || null;

      const { error: updateError } = await supabase
        .from('User')
        // @ts-ignore
        .update(updateData)
        .eq('id', targetUserId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true, message: 'Student updated successfully.' });
    }

    // Default POST behavior: Create new student user (Add Student form)
    const { email, fullName, phone, bmdcNumber, profileImage, batchId, enrollmentDate } = body;
    if (!email || !fullName) {
      return NextResponse.json({ error: 'Email and full name are required.' }, { status: 400 });
    }

    if (!batchId && !enrollmentDate) {
      return NextResponse.json({ error: 'Either batchId or enrollmentDate is required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data: existingUser }: { data: any } = await supabase
      .from('User')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json({ error: 'A student with this email address already exists.' }, { status: 409 });
    }

    const userId = nanoid();
    const nowStr = new Date().toISOString();

    const { error: insertError } = await supabase.from('User')
      // @ts-ignore
      .insert({
        id: userId,
        email: normalizedEmail,
        fullName: fullName.trim(),
        phone: phone?.trim() || null,
        bmdcNumber: bmdcNumber?.trim() || null,
        profileImage: profileImage || null,
        role: 'student',
        emailVerified: true,
        passwordHash: 'MIGRATED_USER_NO_PASSWORD',
        batchId: batchId || null,
        enrollmentDate: enrollmentDate ? new Date(enrollmentDate).toISOString() : null,
        createdAt: nowStr,
        updatedAt: nowStr,
      } as any);

    if (insertError) throw insertError;

    try {
      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await supabase
        .from('User')
        // @ts-ignore
        .update({
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', userId);

      await sendPasswordSetupEmail({
        email: normalizedEmail,
        fullName: fullName.trim(),
        token: setupToken,
      });
    } catch (emailErr) {
      console.error('[admin/students/manage] Password setup email error:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Student added and invitation sent successfully.',
      userId,
    });
  } catch (error: any) {
    console.error('[admin/students/manage] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authCheck = await requireTeacherOrAdmin(request);
    if (!authCheck.ok) return authCheck.response;

    const body = await request.json();
    const targetUserId = body.id || body.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (body.fullName !== undefined) updateData.fullName = body.fullName?.trim() || null;
    if (body.email !== undefined) updateData.email = body.email?.trim().toLowerCase() || null;
    if (body.phone !== undefined) updateData.phone = body.phone?.trim() || null;
    if (body.bmdcNumber !== undefined) updateData.bmdcNumber = body.bmdcNumber?.trim() || null;
    if (body.profileImage !== undefined) updateData.profileImage = body.profileImage || null;
    if (body.batchId !== undefined) updateData.batchId = body.batchId || null;
    if (body.enrollmentDate !== undefined) updateData.enrollmentDate = body.enrollmentDate ? new Date(body.enrollmentDate).toISOString() : null;

    const { error: updateError } = await supabase
      .from('User')
      // @ts-ignore
      .update(updateData)
      .eq('id', targetUserId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Student updated successfully.',
    });
  } catch (error: any) {
    console.error('[admin/students/manage] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await requireTeacherOrAdmin(request);
    if (!authCheck.ok) return authCheck.response;

    const body = await request.json();
    const targetUserId = body.id || body.userId;

    if (!targetUserId) {
      return NextResponse.json({ error: 'Student ID is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error: deleteError } = await supabase
      .from('User')
      .delete()
      .eq('id', targetUserId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Student deleted successfully.',
    });
  } catch (error: any) {
    console.error('[admin/students/manage] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
