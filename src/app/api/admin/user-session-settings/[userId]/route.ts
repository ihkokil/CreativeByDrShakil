import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { getAutoLockSetting, setAutoLockSetting } from '@/lib/session-manager';
import { db } from '@/lib/db';

/**
 * GET /api/admin/user-session-settings/[userId]
 * Get user's auto-lock setting and exemption status
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
    const userRecord = await db.user.findUnique({
      where: { id: userId },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const autoLockSetting = await getAutoLockSetting(userId);

    return NextResponse.json({
      userId,
      autoLockFirstBrowser: autoLockSetting,
      isSessionLockedExempt: userRecord.isSessionLockedExempt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/user-session-settings/[userId]
 * Update user's auto-lock setting and/or exemption status
 * Body: {autoLockFirstBrowser?: boolean, isSessionLockedExempt?: boolean}
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
    const { autoLockFirstBrowser, isSessionLockedExempt } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify user exists
    const userRecord = await db.user.findUnique({
      where: { id: userId },
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (autoLockFirstBrowser !== undefined) {
      if (typeof autoLockFirstBrowser !== 'boolean') {
        return NextResponse.json({ error: 'autoLockFirstBrowser must be a boolean' }, { status: 400 });
      }
      await setAutoLockSetting(userId, autoLockFirstBrowser);
    }

    if (isSessionLockedExempt !== undefined) {
      if (typeof isSessionLockedExempt !== 'boolean') {
        return NextResponse.json({ error: 'isSessionLockedExempt must be a boolean' }, { status: 400 });
      }
      await db.user.update({
        where: { id: userId },
        data: { isSessionLockedExempt }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User settings updated',
      userId,
      autoLockFirstBrowser: autoLockFirstBrowser !== undefined ? autoLockFirstBrowser : await getAutoLockSetting(userId),
      isSessionLockedExempt: isSessionLockedExempt !== undefined ? isSessionLockedExempt : userRecord.isSessionLockedExempt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
