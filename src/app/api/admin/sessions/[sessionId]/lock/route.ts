import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { lockSession } from '@/lib/session-manager';

/**
 * PUT /api/admin/sessions/[sessionId]/lock
 * Lock a specific session to prevent further access
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    await lockSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session locked successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
