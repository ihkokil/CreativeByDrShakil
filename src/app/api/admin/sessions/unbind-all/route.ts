import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { unbindAllDevices } from '@/lib/session-manager';

/**
 * POST /api/admin/sessions/unbind-all
 * Unbinds and resets all registered device hardware slots globally for all students.
 * Accessible by: Admin, Teacher
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await unbindAllDevices();

    return NextResponse.json({
      success: true,
      message: 'All device slots across all students have been reset and unlinked successfully.',
    });
  } catch (error: any) {
    console.error('[admin/sessions/unbind-all] error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
