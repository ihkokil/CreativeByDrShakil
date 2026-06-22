import { db } from './db';
import { deviceSession, sessionLockSettings, globalSessionLockSettings } from '@/db/schema';
import { DeviceType } from './device-detection';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';



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
  };
}

export async function terminateSession(sessionId: string): Promise<void> {
  await db.update(deviceSession)
    .set({ loggedOutAt: new Date().toISOString() })
    .where(eq(deviceSession.id, sessionId));
}

export async function lockSession(sessionId: string): Promise<void> {
  await db.update(deviceSession)
    .set({ isLocked: true })
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

export async function getGlobalAutoLockSetting(): Promise<boolean> {
  const setting = await db.query.globalSessionLockSettings.findFirst({
    where: (gsls, { eq }) => eq(gsls.id, 'global'),
  });

  return setting?.autoLockFirstBrowser ?? true;
}

export async function setGlobalAutoLockSetting(enabled: boolean): Promise<void> {
    const existing = await db.query.globalSessionLockSettings.findFirst({
        where: (gsls, { eq }) => eq(gsls.id, 'global')
    });

    if (existing) {
        await db.update(globalSessionLockSettings)
            .set({ autoLockFirstBrowser: enabled })
            .where(eq(globalSessionLockSettings.id, 'global'));
    } else {
        await db.insert(globalSessionLockSettings)
            .values({ id: 'global', autoLockFirstBrowser: enabled, updatedAt: new Date().toISOString() });
    }
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
