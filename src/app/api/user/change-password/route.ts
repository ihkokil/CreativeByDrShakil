import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords are required.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'New password must be different from current password.' }, { status: 400 });
    }

    const token = await extractCookieToken();
    const supabase = getSupabase(token);

    // Query user and check current password hash
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('id', payload.sub)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!(user as any).passwordHash) {
      return NextResponse.json(
        { error: 'This account is linked to Google. Please use Google Sign-in instead of a password.' },
        { status: 400 }
      );
    }

    const { compare, hash } = await import('bcryptjs');
    const isCurrentValid = await compare(currentPassword, (user as any).passwordHash);

    if (!isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    // Hash and update to the new password in DB
    const newHash = await hash(newPassword, 12);
    
    const { error: updateError } = await supabase
      .from('User')
      // @ts-ignore
      .update({
        passwordHash: newHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      })
      .eq('id', (user as any).id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
