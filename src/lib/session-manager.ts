import { prisma } from './prisma';
import { DeviceType } from './device-detection';

export interface CreateSessionOptions {
  userId: string;
  deviceType: DeviceType;
  browserName: string;
  userAgent: string;
  ipAddress: string;
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
}

export interface AutoLockResolution {
  effectiveAutoLockFirstBrowser: boolean;
  hasUserOverride: boolean;
  userAutoLockFirstBrowser: boolean | null;
  globalAutoLockFirstBrowser: boolean;
}

/**
 * Create a new device session
 */
export async function createDeviceSession(options: CreateSessionOptions): Promise<SessionInfo> {
  const session = await prisma.deviceSession.create({
    data: {
      userId: options.userId,
      deviceType: options.deviceType,
      browserName: options.browserName,
      userAgent: options.userAgent,
      ipAddress: options.ipAddress,
    },
  });

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  };
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.deviceSession.findMany({
    where: {
      userId,
      loggedOutAt: null,
      isLocked: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
  }));
}

/**
 * Get all sessions for a user (including logged out and locked)
 */
export async function getAllSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.deviceSession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
  }));
}

/**
 * Get active session of a specific device type for a user
 */
export async function getActiveSessionByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const session = await prisma.deviceSession.findFirst({
    where: {
      userId,
      deviceType,
      loggedOutAt: null,
      isLocked: false,
    },
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  };
}

/**
 * Get all active sessions of a specific device type for a user
 */
export async function getActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo[]> {
  const sessions = await prisma.deviceSession.findMany({
    where: {
      userId,
      deviceType,
      loggedOutAt: null,
      isLocked: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: s.loggedOutAt,
    createdAt: s.createdAt,
    lastActivityAt: s.lastActivityAt,
  }));
}

/**
 * Terminate all active sessions of a specific device type for a user
 */
export async function terminateActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<string[]> {
  const sessions = await getActiveSessionsByDeviceType(userId, deviceType);
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length === 0) {
    return [];
  }

  await prisma.deviceSession.updateMany({
    where: { id: { in: sessionIds } },
    data: { loggedOutAt: new Date() },
  });

  return sessionIds;
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<SessionInfo | null> {
  const session = await prisma.deviceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: session.loggedOutAt,
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
  };
}

/**
 * Terminate a session (mark as logged out)
 */
export async function terminateSession(sessionId: string): Promise<void> {
  await prisma.deviceSession.update({
    where: { id: sessionId },
    data: {
      loggedOutAt: new Date(),
    },
  });
}

/**
 * Lock a session (prevent future access)
 */
export async function lockSession(sessionId: string): Promise<void> {
  await prisma.deviceSession.update({
    where: { id: sessionId },
    data: {
      isLocked: true,
    },
  });
}

/**
 * Unlock a session
 */
export async function unlockSession(sessionId: string): Promise<void> {
  await prisma.deviceSession.update({
    where: { id: sessionId },
    data: {
      isLocked: false,
    },
  });
}

/**
 * Check if session is still valid (not locked and not logged out)
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await prisma.deviceSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) return false;
  return !session.isLocked && !session.loggedOutAt;
}

/**
 * Update last activity timestamp for a session
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  await prisma.deviceSession.update({
    where: { id: sessionId },
    data: {
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Get Lock First Browser setting for a user
 * Returns user-specific setting if exists, otherwise returns global setting (default: true)
 */
export async function getAutoLockSetting(userId: string): Promise<boolean> {
  const resolution = await resolveAutoLockSetting(userId);
  return resolution.effectiveAutoLockFirstBrowser;
}

/**
 * Update Lock First Browser setting for a user
 */
export async function setAutoLockSetting(userId: string, enabled: boolean): Promise<void> {
  await prisma.sessionLockSettings.upsert({
    where: { userId },
    create: {
      userId,
      autoLockFirstBrowser: enabled,
    },
    update: {
      autoLockFirstBrowser: enabled,
    },
  });
}

/**
 * Get global Lock First Browser setting
 */
export async function getGlobalAutoLockSetting(): Promise<boolean> {
  const setting = await prisma.globalSessionLockSettings.findUnique({
    where: { id: 'global' },
  });

  return setting?.autoLockFirstBrowser ?? true;
}

/**
 * Update global Lock First Browser setting
 */
export async function setGlobalAutoLockSetting(enabled: boolean): Promise<void> {
  await prisma.globalSessionLockSettings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      autoLockFirstBrowser: enabled,
    },
    update: {
      autoLockFirstBrowser: enabled,
    },
  });
}

/**
 * Resolve effective lock setting for a user with global fallback
 */
export async function resolveAutoLockSetting(userId: string): Promise<AutoLockResolution> {
  const [userSetting, globalAutoLockFirstBrowser] = await Promise.all([
    prisma.sessionLockSettings.findUnique({ where: { userId } }),
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

/**
 * Get all session lock settings overrides
 */
export async function getAllSessionLockSettings() {
  return prisma.sessionLockSettings.findMany();
}
