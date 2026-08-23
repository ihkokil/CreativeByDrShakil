import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getSupabaseAdmin } from '@/lib/db';

/**
 * POST /api/admin/sessions/reset-category
 * Resets/Unbinds a device category slot (desktop, tablet, mobile, or all) for a student.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, deviceType } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase.from('DeviceSession').delete().eq('userId', userId);

    if (deviceType && ['desktop', 'tablet', 'mobile'].includes(deviceType)) {
      query = query.eq('deviceType', deviceType);
    }

    const { error: deleteError } = await query;

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: deviceType
        ? `Successfully reset and unlinked ${deviceType} slot for this user.`
        : 'Successfully reset all device slots for this user.',
    });
  } catch (error: any) {
    console.error('[admin/sessions/reset-category] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
