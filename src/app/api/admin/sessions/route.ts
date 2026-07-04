import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import {
  resolveAutoLockSetting,
  setAutoLockSetting,
  getGlobalAutoLockSetting,
  setGlobalAutoLockSetting,
} from '@/lib/session-manager';

/**
 * GET /api/admin/sessions
 * List all students and their device sessions
 * Returns: {students: [{id, fullName, email, sessions: [...]}]}
 */
export async function GET() {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all students
    const students = await db.user.findMany({
      where: { role: 'student' },
      select: {
        id: true,
        fullName: true,
        email: true,
        deviceSessions: {
          select: {
            id: true,
            deviceType: true,
            browserName: true,
            ipAddress: true,
            isLocked: true,
            loggedOutAt: true,
            createdAt: true,
            lastActivityAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        sessionSettings: {
          select: {
            autoLockFirstBrowser: true,
          },
        },
      },
    });

    const globalAutoLockSetting = await getGlobalAutoLockSetting();

    // Format response
    const response = {
      globalAutoLockSetting,
      students: await Promise.all(
        students.map(async (student) => {
          const resolved = await resolveAutoLockSetting(student.id);
          const activeSessions = student.deviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

          return {
            id: student.id,
            fullName: student.fullName,
            email: student.email,
            autoLockSetting: resolved.effectiveAutoLockFirstBrowser,
            hasUserOverride: resolved.hasUserOverride,
            userAutoLockSetting: resolved.userAutoLockFirstBrowser,
            activeSessions,
            sessions: activeSessions,
          };
        })
      ),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/sessions/settings
 * Update global auto-lock setting
 * Body: {autoLockFirstBrowser: boolean}
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { autoLockFirstBrowser, allowDesktop, allowTablet, allowMobile, maxConcurrentSessions, userId } = body;

    // If userId is provided, update user-specific setting
    if (userId) {
      if (typeof autoLockFirstBrowser !== 'boolean') {
        return NextResponse.json({ error: 'autoLockFirstBrowser must be a boolean' }, { status: 400 });
      }
      await setAutoLockSetting(userId, autoLockFirstBrowser);
      return NextResponse.json({
        success: true,
        message: 'User-specific lock setting updated',
      });
    }

    // Validate global settings if provided
    const settingsUpdate: any = {};
    if (autoLockFirstBrowser !== undefined) {
      if (typeof autoLockFirstBrowser !== 'boolean') return NextResponse.json({ error: 'autoLockFirstBrowser must be a boolean' }, { status: 400 });
      settingsUpdate.autoLockFirstBrowser = autoLockFirstBrowser;
    }
    if (allowDesktop !== undefined) {
      if (typeof allowDesktop !== 'boolean') return NextResponse.json({ error: 'allowDesktop must be a boolean' }, { status: 400 });
      settingsUpdate.allowDesktop = allowDesktop;
    }
    if (allowTablet !== undefined) {
      if (typeof allowTablet !== 'boolean') return NextResponse.json({ error: 'allowTablet must be a boolean' }, { status: 400 });
      settingsUpdate.allowTablet = allowTablet;
    }
    if (allowMobile !== undefined) {
      if (typeof allowMobile !== 'boolean') return NextResponse.json({ error: 'allowMobile must be a boolean' }, { status: 400 });
      settingsUpdate.allowMobile = allowMobile;
    }
    if (maxConcurrentSessions !== undefined) {
      if (typeof maxConcurrentSessions !== 'number') return NextResponse.json({ error: 'maxConcurrentSessions must be a number' }, { status: 400 });
      settingsUpdate.maxConcurrentSessions = maxConcurrentSessions;
    }

    const { setGlobalSessionSettings } = await import('@/lib/session-manager');
    await setGlobalSessionSettings(settingsUpdate);

    return NextResponse.json({
      success: true,
      message: 'Global session settings updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
