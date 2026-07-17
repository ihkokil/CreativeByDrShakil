import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';
import { nanoid } from '@/lib/nanoid';
import { createTokenPair, hashToken } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const body = await request.json();
    const { email, fullName, designation, institution, degrees } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 });
    }
    if (!fullName || typeof fullName !== 'string') {
      return NextResponse.json({ error: 'fullName is required.' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check if user with this email already exists
    const { data: existingUser }: { data: any } = await supabase
      .from('User')
      .select('id, email, role')
      .eq('email', email.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.role === 'teacher' || existingUser.role === 'admin') {
        return NextResponse.json({ error: 'A teacher with this email already exists.' }, { status: 409 });
      }

      // Upgrade existing student to teacher
      const { error: upgradeError } = await supabase
        .from('User')
        // @ts-ignore
        .update({
          role: 'teacher',
          fullName: fullName.trim(),
          designation: designation?.trim() || null,
          institution: institution?.trim() || null,
          degrees: degrees?.trim() || null,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      if (upgradeError) throw upgradeError;

      return NextResponse.json({
        success: true,
        message: `Upgraded existing student ${email} to teacher.`,
        teacherId: existingUser.id,
      });
    }

    // Create new teacher
    const teacherId = nanoid();
    const nowStr = new Date().toISOString();

    const { error: insertError } = await supabase.from('User').insert({
      id: teacherId,
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      role: 'teacher',
      designation: designation?.trim() || null,
      institution: institution?.trim() || null,
      degrees: degrees?.trim() || null,
      emailVerified: true,
      createdAt: nowStr,
      updatedAt: nowStr,
    } as any);

    if (insertError) throw insertError;

    // Send password setup email
    try {
      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await supabase
        .from('User')
        // @ts-ignore
        .update({
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
        })
        .eq('id', teacherId);

      await sendPasswordSetupEmail({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        token: setupToken,
      });
    } catch (emailErr) {
      console.error('[admin/invite-teacher] Setup email failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: `Teacher ${fullName} invited and password setup email sent.`,
      teacherId,
    });
  } catch (error: any) {
    console.error('[admin/invite-teacher] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
