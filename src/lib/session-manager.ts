import { db } from './db';
import { DeviceType } from './client-fingerprint';

export interface CreateSessionOptions {
  userId: string;
  deviceType: DeviceType;
  browserName: string;
  userAgent: string;
  ipAddress: string;
  deviceHash?: string;
  deviceLabel?: string;
  osInfo?: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceType: DeviceType;
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: Date | null;
  createdAt: Date;
  lastActivityAt: Date;
  deviceHash: string | null;
  deviceLabel: string | null;
  osInfo: string | null;
  lockedByDeviceLabel: string | null;
}

export interface AutoLockResolution {
  effectiveAutoLockFirstBrowser: boolean;
  hasUserOverride: boolean;
  userAutoLockFirstBrowser: boolean | null;
  globalAutoLockFirstBrowser: boolean;
}

export async function createDeviceSession(options: CreateSessionOptions): Promise<SessionInfo> {
  const session = await db.deviceSession.create({
    data: {
      userId: options.userId,
      deviceType: options.deviceType,
      browserName: options.browserName,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
      deviceHash: options.deviceHash || null,
      deviceLabel: options.deviceLabel || null,
      osInfo: options.osInfo || null,
    }
  });

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function getActiveSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.deviceSession.findMany({
    where: {
      userId,
      loggedOutAt: null,
      isLocked: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
    deviceHash: s.deviceHash,
    deviceLabel: s.deviceLabel,
    osInfo: s.osInfo,
    lockedByDeviceLabel: s.lockedByDeviceLabel,
  }));
}

export async function getAllSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.deviceSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
    deviceHash: s.deviceHash,
    deviceLabel: s.deviceLabel,
    osInfo: s.osInfo,
    lockedByDeviceLabel: s.lockedByDeviceLabel,
  }));
}

export async function getActiveSessionByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const session = await db.deviceSession.findFirst({
    where: {
      userId,
      deviceType: deviceType as any,
      loggedOutAt: null,
      isLocked: false,
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function getActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo[]> {
  const sessions = await db.deviceSession.findMany({
    where: {
      userId,
      deviceType: deviceType as any,
      loggedOutAt: null,
      isLocked: false,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
    deviceHash: s.deviceHash,
    deviceLabel: s.deviceLabel,
    osInfo: s.osInfo,
    lockedByDeviceLabel: s.lockedByDeviceLabel,
  }));
}

export async function terminateActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<string[]> {
  const sessions = await getActiveSessionsByDeviceType(userId, deviceType);
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length === 0) {
    return [];
  }

  await db.deviceSession.updateMany({
    where: {
      id: { in: sessionIds }
    },
    data: {
      loggedOutAt: new Date()
    }
  });

  return sessionIds;
}

export async function getSessionById(sessionId: string): Promise<SessionInfo | null> {
  const session = await db.deviceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function terminateSession(sessionId: string): Promise<void> {
  await db.deviceSession.update({
    where: { id: sessionId },
    data: { loggedOutAt: new Date() }
  });
}

export async function lockSession(sessionId: string, lockedBy: string = 'Administrator'): Promise<void> {
  await db.deviceSession.update({
    where: { id: sessionId },
    data: { isLocked: true, lockedByDeviceLabel: lockedBy }
  });
}

export async function updateSessionDeviceHash(sessionId: string, deviceHash: string): Promise<void> {
  await db.deviceSession.update({
    where: { id: sessionId },
    data: { deviceHash }
  });
}

export async function unlockSession(sessionId: string): Promise<void> {
  await db.deviceSession.update({
    where: { id: sessionId },
    data: { isLocked: false }
  });
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await db.deviceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return false;
  return !session.isLocked && !session.loggedOutAt;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await db.deviceSession.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() }
  });
}

export async function getAutoLockSetting(userId: string): Promise<boolean> {
  const resolution = await resolveAutoLockSetting(userId);
  return resolution.effectiveAutoLockFirstBrowser;
}

export async function setAutoLockSetting(userId: string, enabled: boolean): Promise<void> {
    await db.sessionLockSettings.upsert({
        where: { userId },
        update: { autoLockFirstBrowser: enabled },
        create: { userId, autoLockFirstBrowser: enabled }
    });
}

export interface GlobalSessionSettings {
  autoLockFirstBrowser: boolean;
  allowDesktop: boolean;
  allowTablet: boolean;
  allowMobile: boolean;
  maxConcurrentSessions: number;
}

export async function getGlobalSessionSettings(): Promise<GlobalSessionSettings> {
  const setting = await db.globalSessionLockSettings.findUnique({
    where: { id: 'global' },
  });

  return {
    autoLockFirstBrowser: setting?.autoLockFirstBrowser ?? true,
    allowDesktop: setting?.allowDesktop ?? true,
    allowTablet: setting?.allowTablet ?? true,
    allowMobile: setting?.allowMobile ?? true,
    maxConcurrentSessions: setting?.maxConcurrentSessions ?? 3,
  };
}

export async function setGlobalSessionSettings(settings: Partial<GlobalSessionSettings>): Promise<void> {
  const updatedFields: any = {};
  if (settings.autoLockFirstBrowser !== undefined) updatedFields.autoLockFirstBrowser = settings.autoLockFirstBrowser;
  if (settings.allowDesktop !== undefined) updatedFields.allowDesktop = settings.allowDesktop;
  if (settings.allowTablet !== undefined) updatedFields.allowTablet = settings.allowTablet;
  if (settings.allowMobile !== undefined) updatedFields.allowMobile = settings.allowMobile;
  if (settings.maxConcurrentSessions !== undefined) updatedFields.maxConcurrentSessions = settings.maxConcurrentSessions;

  await db.globalSessionLockSettings.upsert({
      where: { id: 'global' },
      update: updatedFields,
      create: {
          id: 'global',
          autoLockFirstBrowser: settings.autoLockFirstBrowser ?? true,
          allowDesktop: settings.allowDesktop ?? true,
          allowTablet: settings.allowTablet ?? true,
          allowMobile: settings.allowMobile ?? true,
          maxConcurrentSessions: settings.maxConcurrentSessions ?? 3,
      }
  });
}

export async function getGlobalAutoLockSetting(): Promise<boolean> {
  const settings = await getGlobalSessionSettings();
  return settings.autoLockFirstBrowser;
}

export async function setGlobalAutoLockSetting(enabled: boolean): Promise<void> {
  await setGlobalSessionSettings({ autoLockFirstBrowser: enabled });
}

export async function resolveAutoLockSetting(userId: string): Promise<AutoLockResolution> {
  const [userSetting, globalAutoLockFirstBrowser] = await Promise.all([
    db.sessionLockSettings.findUnique({ where: { userId } }),
    getGlobalAutoLockSetting(),
  ]);

  const hasUserOverride = Boolean(userSetting);
  const userAutoLockFirstBrowser = userSetting?.autoLockFirstBrowser ?? null;
  const effectiveAutoLockFirstBrowser =
    userAutoLockFirstBrowser ?? globalAutoLockFirstBrowser;

  return {
    effectiveAutoLockFirstBrowser,
    hasUserOverride,
    userAutoLockFirstBrowser,
    globalAutoLockFirstBrowser,
  };
}

export async function getAllSessionLockSettings() {
  return db.sessionLockSettings.findMany();
}

export async function terminateAllSessions(): Promise<void> {
  // Only terminate sessions belonging to students (not admin/teacher)
  await db.deviceSession.updateMany({
    where: {
      loggedOutAt: null,
      user: {
        role: 'student'
      }
    },
    data: {
      loggedOutAt: new Date()
    }
  });
}
