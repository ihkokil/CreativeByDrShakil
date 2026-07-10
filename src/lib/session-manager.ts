import { db } from './db';
import { deviceSession, sessionLockSettings, globalSessionLockSettings } from '@/db/schema';
import { DeviceType } from './client-fingerprint';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';



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

function mapDate(d: string | null): Date | null {
    return d ? new Date(d) : null;
}

export async function createDeviceSession(options: CreateSessionOptions): Promise<SessionInfo> {
  const [session] = await db.insert(deviceSession).values({
    id: crypto.randomUUID(), // Using UUID instead of CUID for new ones
    userId: options.userId,
    deviceType: options.deviceType,
    browserName: options.browserName,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    deviceHash: options.deviceHash || null,
    deviceLabel: options.deviceLabel || null,
    osInfo: options.osInfo || null,
  }).returning();

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: mapDate(session.loggedOutAt),
    createdAt: new Date(session.createdAt),
    lastActivityAt: new Date(session.lastActivityAt),
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function getActiveSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSession.findMany({
    where: (ds, { eq, and, isNull }) => and(eq(ds.userId, userId), isNull(ds.loggedOutAt), eq(ds.isLocked, false)),
    orderBy: (ds, { desc }) => [desc(ds.createdAt)],
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: mapDate(s.loggedOutAt),
    createdAt: new Date(s.createdAt),
    lastActivityAt: new Date(s.lastActivityAt),
    deviceHash: s.deviceHash,
    deviceLabel: s.deviceLabel,
    osInfo: s.osInfo,
    lockedByDeviceLabel: s.lockedByDeviceLabel,
  }));
}

export async function getAllSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSession.findMany({
    where: (ds, { eq }) => eq(ds.userId, userId),
    orderBy: (ds, { desc }) => [desc(ds.createdAt)],
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: mapDate(s.loggedOutAt),
    createdAt: new Date(s.createdAt),
    lastActivityAt: new Date(s.lastActivityAt),
    deviceHash: s.deviceHash,
    deviceLabel: s.deviceLabel,
    osInfo: s.osInfo,
    lockedByDeviceLabel: s.lockedByDeviceLabel,
  }));
}

export async function getActiveSessionByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const session = await db.query.deviceSession.findFirst({
    where: (ds, { eq, and, isNull }) => and(
        eq(ds.userId, userId), 
        eq(ds.deviceType, deviceType),
        isNull(ds.loggedOutAt), 
        eq(ds.isLocked, false)
    ),
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: mapDate(session.loggedOutAt),
    createdAt: new Date(session.createdAt),
    lastActivityAt: new Date(session.lastActivityAt),
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function getActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSession.findMany({
    where: (ds, { eq, and, isNull }) => and(
        eq(ds.userId, userId), 
        eq(ds.deviceType, deviceType),
        isNull(ds.loggedOutAt), 
        eq(ds.isLocked, false)
    ),
    orderBy: (ds, { desc }) => [desc(ds.createdAt)],
  });

  return sessions.map((s) => ({
    id: s.id,
    userId: s.userId,
    deviceType: s.deviceType as DeviceType,
    browserName: s.browserName,
    ipAddress: s.ipAddress,
    isLocked: s.isLocked,
    loggedOutAt: mapDate(s.loggedOutAt),
    createdAt: new Date(s.createdAt),
    lastActivityAt: new Date(s.lastActivityAt),
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

  await db.update(deviceSession)
    .set({ loggedOutAt: new Date().toISOString() })
    .where(inArray(deviceSession.id, sessionIds));

  return sessionIds;
}

export async function getFirstDeviceForCategory(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const session = await db.query.deviceSession.findFirst({
    where: (ds, { eq, and, isNotNull }) => and(
      eq(ds.userId, userId),
      eq(ds.deviceType, deviceType),
      isNotNull(ds.deviceHash)
    ),
    orderBy: (ds, { asc }) => [asc(ds.createdAt)],
  });
  if (!session) return null;
  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: mapDate(session.loggedOutAt),
    createdAt: new Date(session.createdAt),
    lastActivityAt: new Date(session.lastActivityAt),
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function getSessionById(sessionId: string): Promise<SessionInfo | null> {
  const session = await db.query.deviceSession.findFirst({
    where: (ds, { eq }) => eq(ds.id, sessionId),
  });

  if (!session) return null;

  return {
    id: session.id,
    userId: session.userId,
    deviceType: session.deviceType as DeviceType,
    browserName: session.browserName,
    ipAddress: session.ipAddress,
    isLocked: session.isLocked,
    loggedOutAt: mapDate(session.loggedOutAt),
    createdAt: new Date(session.createdAt),
    lastActivityAt: new Date(session.lastActivityAt),
    deviceHash: session.deviceHash,
    deviceLabel: session.deviceLabel,
    osInfo: session.osInfo,
    lockedByDeviceLabel: session.lockedByDeviceLabel,
  };
}

export async function terminateSession(sessionId: string): Promise<void> {
  await db.update(deviceSession)
    .set({ loggedOutAt: new Date().toISOString() })
    .where(eq(deviceSession.id, sessionId));
}

export async function lockSession(sessionId: string, lockedBy: string = 'Administrator'): Promise<void> {
  await db.update(deviceSession)
    .set({ isLocked: true, lockedByDeviceLabel: lockedBy })
    .where(eq(deviceSession.id, sessionId));
}

export async function updateSessionDeviceHash(sessionId: string, deviceHash: string): Promise<void> {
  await db.update(deviceSession)
    .set({ deviceHash })
    .where(eq(deviceSession.id, sessionId));
}

export async function unlockSession(sessionId: string): Promise<void> {
  await db.update(deviceSession)
    .set({ isLocked: false })
    .where(eq(deviceSession.id, sessionId));
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await db.query.deviceSession.findFirst({
    where: (ds, { eq }) => eq(ds.id, sessionId),
  });

  if (!session) return false;
  return !session.isLocked && !session.loggedOutAt;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await db.update(deviceSession)
    .set({ lastActivityAt: new Date().toISOString() })
    .where(eq(deviceSession.id, sessionId));
}

export async function getAutoLockSetting(userId: string): Promise<boolean> {
  const resolution = await resolveAutoLockSetting(userId);
  return resolution.effectiveAutoLockFirstBrowser;
}

export async function setAutoLockSetting(userId: string, enabled: boolean): Promise<void> {
    const existing = await db.query.sessionLockSettings.findFirst({
        where: (sls, { eq }) => eq(sls.userId, userId)
    });

    if (existing) {
        await db.update(sessionLockSettings)
            .set({ autoLockFirstBrowser: enabled })
            .where(eq(sessionLockSettings.userId, userId));
    } else {
        await db.insert(sessionLockSettings)
            .values({ id: crypto.randomUUID(), userId, autoLockFirstBrowser: enabled, updatedAt: new Date().toISOString() });
    }
}

export interface GlobalSessionSettings {
  autoLockFirstBrowser: boolean;
  allowDesktop: boolean;
  allowTablet: boolean;
  allowMobile: boolean;
  maxConcurrentSessions: number;
}

export async function getGlobalSessionSettings(): Promise<GlobalSessionSettings> {
  const setting = await db.query.globalSessionLockSettings.findFirst({
    where: (gsls, { eq }) => eq(gsls.id, 'global'),
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
  const existing = await db.query.globalSessionLockSettings.findFirst({
    where: (gsls, { eq }) => eq(gsls.id, 'global')
  });

  const updatedFields: any = {
    updatedAt: new Date().toISOString(),
  };
  if (settings.autoLockFirstBrowser !== undefined) updatedFields.autoLockFirstBrowser = settings.autoLockFirstBrowser;
  if (settings.allowDesktop !== undefined) updatedFields.allowDesktop = settings.allowDesktop;
  if (settings.allowTablet !== undefined) updatedFields.allowTablet = settings.allowTablet;
  if (settings.allowMobile !== undefined) updatedFields.allowMobile = settings.allowMobile;
  if (settings.maxConcurrentSessions !== undefined) updatedFields.maxConcurrentSessions = settings.maxConcurrentSessions;

  if (existing) {
    await db.update(globalSessionLockSettings)
      .set(updatedFields)
      .where(eq(globalSessionLockSettings.id, 'global'));
  } else {
    await db.insert(globalSessionLockSettings)
      .values({
        id: 'global',
        autoLockFirstBrowser: settings.autoLockFirstBrowser ?? true,
        allowDesktop: settings.allowDesktop ?? true,
        allowTablet: settings.allowTablet ?? true,
        allowMobile: settings.allowMobile ?? true,
        maxConcurrentSessions: settings.maxConcurrentSessions ?? 3,
        updatedAt: new Date().toISOString(),
      });
  }
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
    db.query.sessionLockSettings.findFirst({ where: (sls, { eq }) => eq(sls.userId, userId) }),
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
  return db.query.sessionLockSettings.findMany();
}

export async function terminateAllSessions(): Promise<void> {
  // Only terminate sessions belonging to students (not admin/teacher)
  const { user } = await import('@/db/schema');
  const studentIds = db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.role, 'student'));

  await db.update(deviceSession)
    .set({ loggedOutAt: new Date().toISOString() })
    .where(and(
      isNull(deviceSession.loggedOutAt),
      inArray(deviceSession.userId, studentIds)
    ));
}
