import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { terminateSession } from '@/lib/session-manager';

/**
 * PUT /api/admin/sessions/[sessionId]/logout
 * Force logout a specific session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await getSession();

    if (!auth || auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    await terminateSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session logged out successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
