import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required.' }, { status: 400 });
    }
    if (!action || !['ban', 'unban'].includes(action)) {
      return NextResponse.json({ error: 'action must be "ban" or "unban".' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: userError }: { data: any; error: any } = await supabase
      .from('User')
      .select('id, role, fullName, isBanned')
      .eq('id', userId)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Cannot ban an admin user.' }, { status: 403 });
    }

    const isBanned = action === 'ban';

    if (isBanned) {
      const { error: banError } = await supabase.rpc('fn_ban_user', {
        p_user_id: userId,
        p_banned_by_label: `Teacher (${payload.email})`
      });
      if (banError) throw banError;
    } else {
      const { error: updateError } = await supabase
        .from('User')
        // @ts-ignore
        .update({ isBanned: false, updatedAt: new Date().toISOString() })
        .eq('id', userId);
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.fullName} has been ${isBanned ? 'banned' : 'unbanned'}.`,
      isBanned,
    });
  } catch (error: any) {
    console.error('[teacher/users/ban] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
