import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const students = await prisma.user.findMany({
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
    const { autoLockFirstBrowser, userId } = body;

    if (typeof autoLockFirstBrowser !== 'boolean') {
      return NextResponse.json({ error: 'autoLockFirstBrowser must be a boolean' }, { status: 400 });
    }

    // If userId is provided, update user-specific setting
    if (userId) {
      await setAutoLockSetting(userId, autoLockFirstBrowser);
      return NextResponse.json({
        success: true,
        message: 'User-specific lock setting updated',
      });
    }

    // Otherwise, update true global setting
    await setGlobalAutoLockSetting(autoLockFirstBrowser);

    return NextResponse.json({
      success: true,
      message: 'Global lock setting updated',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
