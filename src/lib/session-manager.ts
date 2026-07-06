import { db } from './db';
import { DeviceType } from './client-fingerprint';
import { eq, and, or, desc, inArray, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { createId } from '@paralleldrive/cuid2';

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
  const newId = createId();
  await db.insert(schema.deviceSessions).values({
    id: newId,
    userId: options.userId,
    deviceType: options.deviceType as any,
    browserName: options.browserName,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    deviceHash: options.deviceHash || null,
    deviceLabel: options.deviceLabel || null,
    osInfo: options.osInfo || null,
  });
  
  const session = await db.query.deviceSessions.findFirst({
    where: eq(schema.deviceSessions.id, newId)
  });

  return {
    id: session!.id,
    userId: session!.userId,
    deviceType: session!.deviceType as DeviceType,
    browserName: session!.browserName,
    ipAddress: session!.ipAddress,
    isLocked: session!.isLocked,
    loggedOutAt: session!.loggedOutAt,
    createdAt: session!.createdAt,
    lastActivityAt: session!.lastActivityAt,
    deviceHash: session!.deviceHash,
    deviceLabel: session!.deviceLabel,
    osInfo: session!.osInfo,
    lockedByDeviceLabel: session!.lockedByDeviceLabel,
  };
}

export async function getActiveSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSessions.findMany({
    where: and(
      eq(schema.deviceSessions.userId, userId),
      isNull(schema.deviceSessions.loggedOutAt),
      eq(schema.deviceSessions.isLocked, false)
    ),
    orderBy: [desc(schema.deviceSessions.createdAt)],
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
  const sessions = await db.query.deviceSessions.findMany({
    where: eq(schema.deviceSessions.userId, userId),
    orderBy: [desc(schema.deviceSessions.createdAt)],
  });

  return sessions.map((s) => ({
    ...s,
    deviceType: s.deviceType as DeviceType,
  }));
}

export async function getActiveSessionByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const session = await db.query.deviceSessions.findFirst({
    where: and(
      eq(schema.deviceSessions.userId, userId),
      eq(schema.deviceSessions.deviceType, deviceType as any),
      isNull(schema.deviceSessions.loggedOutAt),
      eq(schema.deviceSessions.isLocked, false)
    ),
  });

  if (!session) return null;

  return {
    ...session,
    deviceType: session.deviceType as DeviceType,
  };
}

export async function getActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<SessionInfo[]> {
  const sessions = await db.query.deviceSessions.findMany({
    where: and(
      eq(schema.deviceSessions.userId, userId),
      eq(schema.deviceSessions.deviceType, deviceType as any),
      isNull(schema.deviceSessions.loggedOutAt),
      eq(schema.deviceSessions.isLocked, false)
    ),
    orderBy: [desc(schema.deviceSessions.createdAt)],
  });

  return sessions.map((s) => ({
    ...s,
    deviceType: s.deviceType as DeviceType,
  }));
}

export async function terminateActiveSessionsByDeviceType(userId: string, deviceType: DeviceType): Promise<string[]> {
  const sessions = await getActiveSessionsByDeviceType(userId, deviceType);
  const sessionIds = sessions.map((s) => s.id);

  if (sessionIds.length === 0) {
    return [];
  }

  await db.update(schema.deviceSessions)
    .set({ loggedOutAt: new Date() })
    .where(inArray(schema.deviceSessions.id, sessionIds));

  return sessionIds;
}

export async function getSessionById(sessionId: string): Promise<SessionInfo | null> {
  const session = await db.query.deviceSessions.findFirst({
    where: eq(schema.deviceSessions.id, sessionId),
  });

  if (!session) return null;

  return {
    ...session,
    deviceType: session.deviceType as DeviceType,
  };
}

export async function terminateSession(sessionId: string): Promise<void> {
  await db.update(schema.deviceSessions)
    .set({ loggedOutAt: new Date() })
    .where(eq(schema.deviceSessions.id, sessionId));
}

export async function lockSession(sessionId: string, lockedBy: string = 'Administrator'): Promise<void> {
  await db.update(schema.deviceSessions)
    .set({ isLocked: true, lockedByDeviceLabel: lockedBy })
    .where(eq(schema.deviceSessions.id, sessionId));
}

export async function updateSessionDeviceHash(sessionId: string, deviceHash: string): Promise<void> {
  await db.update(schema.deviceSessions)
    .set({ deviceHash })
    .where(eq(schema.deviceSessions.id, sessionId));
}

export async function unlockSession(sessionId: string): Promise<void> {
  await db.update(schema.deviceSessions)
    .set({ isLocked: false })
    .where(eq(schema.deviceSessions.id, sessionId));
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const session = await db.query.deviceSessions.findFirst({
    where: eq(schema.deviceSessions.id, sessionId),
  });

  if (!session) return false;
  return !session.isLocked && !session.loggedOutAt;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await db.update(schema.deviceSessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(schema.deviceSessions.id, sessionId));
}

export async function getAutoLockSetting(userId: string): Promise<boolean> {
  const resolution = await resolveAutoLockSetting(userId);
  return resolution.effectiveAutoLockFirstBrowser;
}

export async function setAutoLockSetting(userId: string, enabled: boolean): Promise<void> {
    const existing = await db.query.sessionLockSettings.findFirst({
      where: eq(schema.sessionLockSettings.userId, userId)
    });
    
    if (existing) {
      await db.update(schema.sessionLockSettings)
        .set({ autoLockFirstBrowser: enabled })
        .where(eq(schema.sessionLockSettings.userId, userId));
    } else {
      await db.insert(schema.sessionLockSettings).values({
        id: createId(),
        userId,
        autoLockFirstBrowser: enabled,
      });
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
    where: eq(schema.globalSessionLockSettings.id, 'global'),
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
    where: eq(schema.globalSessionLockSettings.id, 'global'),
  });

  const updatedFields: any = {};
  if (settings.autoLockFirstBrowser !== undefined) updatedFields.autoLockFirstBrowser = settings.autoLockFirstBrowser;
  if (settings.allowDesktop !== undefined) updatedFields.allowDesktop = settings.allowDesktop;
  if (settings.allowTablet !== undefined) updatedFields.allowTablet = settings.allowTablet;
  if (settings.allowMobile !== undefined) updatedFields.allowMobile = settings.allowMobile;
  if (settings.maxConcurrentSessions !== undefined) updatedFields.maxConcurrentSessions = settings.maxConcurrentSessions;

  if (existing) {
    await db.update(schema.globalSessionLockSettings)
      .set(updatedFields)
      .where(eq(schema.globalSessionLockSettings.id, 'global'));
  } else {
    await db.insert(schema.globalSessionLockSettings).values({
      id: 'global',
      autoLockFirstBrowser: settings.autoLockFirstBrowser ?? true,
      allowDesktop: settings.allowDesktop ?? true,
      allowTablet: settings.allowTablet ?? true,
      allowMobile: settings.allowMobile ?? true,
      maxConcurrentSessions: settings.maxConcurrentSessions ?? 3,
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
    db.query.sessionLockSettings.findFirst({ where: eq(schema.sessionLockSettings.userId, userId) }),
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
  const studentSessions = await db.select({ id: schema.deviceSessions.id })
    .from(schema.deviceSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.deviceSessions.userId))
    .where(and(
      isNull(schema.deviceSessions.loggedOutAt),
      eq(schema.users.role, 'student')
    ));
    
  if (studentSessions.length > 0) {
    const sessionIds = studentSessions.map(s => s.id);
    await db.update(schema.deviceSessions)
      .set({ loggedOutAt: new Date() })
      .where(inArray(schema.deviceSessions.id, sessionIds));
  }
}
