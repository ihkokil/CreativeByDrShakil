import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { user as userSchema, deviceSession as deviceSessionSchema, sessionLockSettings as sessionLockSettingsSchema } from '@/db/schema';
import { eq, asc, desc, inArray } from 'drizzle-orm';
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
    const studentsData = await db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email }).from(userSchema).where(eq(userSchema.role, 'student'));

    const studentIds = studentsData.map(s => s.id);
    const [deviceSessions, lockSettings] = await Promise.all([
      studentIds.length > 0
        ? db.select({
            id: deviceSessionSchema.id,
            userId: deviceSessionSchema.userId,
            deviceType: deviceSessionSchema.deviceType,
            browserName: deviceSessionSchema.browserName,
            ipAddress: deviceSessionSchema.ipAddress,
            isLocked: deviceSessionSchema.isLocked,
            loggedOutAt: deviceSessionSchema.loggedOutAt,
            createdAt: deviceSessionSchema.createdAt,
            lastActivityAt: deviceSessionSchema.lastActivityAt,
          }).from(deviceSessionSchema).where(inArray(deviceSessionSchema.userId, studentIds)).orderBy(desc(deviceSessionSchema.createdAt))
        : Promise.resolve([]),
      studentIds.length > 0
        ? db.select({ userId: sessionLockSettingsSchema.userId, autoLockFirstBrowser: sessionLockSettingsSchema.autoLockFirstBrowser }).from(sessionLockSettingsSchema).where(inArray(sessionLockSettingsSchema.userId, studentIds))
        : Promise.resolve([]),
    ]);

    const sessionsMap = new Map<string, typeof deviceSessions[number][]>();
    for (const ds of deviceSessions) {
      const list = sessionsMap.get(ds.userId) || [];
      list.push(ds);
      sessionsMap.set(ds.userId, list);
    }
    const lockSettingsMap = new Map(lockSettings.map(ls => [ls.userId, ls]));

    const students = studentsData.map(s => ({
      ...s,
      deviceSessions: sessionsMap.get(s.id) || [],
      sessionLockSettings: lockSettingsMap.get(s.id) || null,
    }));

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
