import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { nanoid } from '@/lib/nanoid';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await request.json();
    const { action } = body;

    const supabase = getSupabase();

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

      // Check if user exists
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

        const { error: insertError } = await supabase.from('User').insert({
          id: userId,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          phone: phone?.trim() || null,
          role: 'student',
          emailVerified: true,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);

        if (insertError) throw insertError;

        // Send password setup email
        try {
          const { token: setupToken, tokenHash } = await createTokenPair();
          const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

          await supabase
            .from('User')
            // @ts-ignore
            .update({
              passwordResetTokenHash: tokenHash,
              passwordResetExpires: resetExpiry.toISOString(),
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

      // Enroll in course if provided
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
      const { userId, fullName, email, phone, bmdcNumber } = body;

      if (!userId) {
        return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (fullName !== undefined) updateData.fullName = fullName?.trim() || null;
      if (email !== undefined) updateData.email = email?.trim().toLowerCase() || null;
      if (phone !== undefined) updateData.phone = phone?.trim() || null;
      if (bmdcNumber !== undefined) updateData.bmdcNumber = bmdcNumber?.trim() || null;

      const { error: updateError } = await supabase
        .from('User')
        // @ts-ignore
        .update(updateData)
        .eq('id', userId);

      if (updateError) throw updateError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error: any) {
    console.error('[admin/students/manage] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
