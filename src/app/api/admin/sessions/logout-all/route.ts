import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { terminateAllSessions } from '@/lib/session-manager';

/**
 * POST /api/admin/sessions/logout-all
 * Logs out all active user sessions globally.
 * Accessible by: Admin, Teacher
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await terminateAllSessions();

    return NextResponse.json({
      success: true,
      message: 'All active sessions have been logged out successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
