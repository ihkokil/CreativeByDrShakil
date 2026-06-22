import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getAutoLockSetting, setAutoLockSetting } from '@/lib/session-manager';
import { db } from '@/lib/db';

/**
 * GET /api/admin/user-session-settings/[userId]
 * Get user's auto-lock setting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const autoLockSetting = await getAutoLockSetting(userId);

    return NextResponse.json({
      userId,
      autoLockFirstBrowser: autoLockSetting,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/user-session-settings/[userId]
 * Update user's auto-lock setting
 * Body: {autoLockFirstBrowser: boolean}
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { autoLockFirstBrowser } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (typeof autoLockFirstBrowser !== 'boolean') {
      return NextResponse.json({ error: 'autoLockFirstBrowser must be a boolean' }, { status: 400 });
    }

    // Verify user exists
    const user = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await setAutoLockSetting(userId, autoLockFirstBrowser);

    return NextResponse.json({
      success: true,
      message: 'User setting updated',
      userId,
      autoLockFirstBrowser,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
