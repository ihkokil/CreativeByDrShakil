import { getSupabase } from './db';
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

function mapDate(d: string | null): Date | null {
    return d ? new Date(d) : null;
}

export async function createDeviceSession(options: CreateSessionOptions): Promise<SessionInfo> {
  const id = crypto.randomUUID();
  const insertValues = {
    id,
    userId: options.userId,
    deviceType: options.deviceType,
    browserName: options.browserName,
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
    deviceHash: options.deviceHash || null,
    deviceLabel: options.deviceLabel || null,
    osInfo: options.osInfo || null,
  };
  
  const supabase = getSupabase();
  const { error } = await supabase.from('DeviceSession').insert(insertValues as any);
  if (error) throw error;

  return {
    id,
    userId: options.userId,
    deviceType: options.deviceType as DeviceType,
    browserName: options.browserName,
    ipAddress: options.ipAddress,
    isLocked: false,
    loggedOutAt: null,
    createdAt: new Date(),
    lastActivityAt: new Date(),
    deviceHash: options.deviceHash || null,
    deviceLabel: options.deviceLabel || null,
    osInfo: options.osInfo || null,
    lockedByDeviceLabel: null,
  };
}

export async function getActiveSessionsForUser(userId: string): Promise<SessionInfo[]> {
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('userId', userId)
    .is('loggedOutAt', null)
    .eq('isLocked', false)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (sessions || []).map((s: any) => ({
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
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('userId', userId)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (sessions || []).map((s: any) => ({
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
  const supabase = getSupabase();
  const { data: session, error }: { data: any, error: any } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('userId', userId)
    .eq('deviceType', deviceType)
    .is('loggedOutAt', null)
    .eq('isLocked', false)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('userId', userId)
    .eq('deviceType', deviceType)
    .is('loggedOutAt', null)
    .eq('isLocked', false)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (sessions || []).map((s: any) => ({
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
  const sessionIds = sessions.map((s: any) => s.id);

  if (sessionIds.length === 0) {
    return [];
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ loggedOutAt: new Date().toISOString() })
    .in('id', sessionIds);

  if (error) throw error;

  return sessionIds;
}

export async function getFirstDeviceForCategory(userId: string, deviceType: DeviceType): Promise<SessionInfo | null> {
  const supabase = getSupabase();
  const { data: session, error }: { data: any, error: any } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('userId', userId)
    .eq('deviceType', deviceType)
    .not('deviceHash', 'is', null)
    .order('createdAt', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
  const supabase = getSupabase();
  const { data: session, error }: { data: any, error: any } = await supabase
    .from('DeviceSession')
    .select('*')
    .eq('id', sessionId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
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
  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ loggedOutAt: new Date().toISOString() })
    .eq('id', sessionId);
  
  if (error) throw error;
}

export async function lockSession(sessionId: string, lockedBy: string = 'Administrator'): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ isLocked: true, lockedByDeviceLabel: lockedBy })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function updateSessionDeviceHash(sessionId: string, deviceHash: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ deviceHash })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function unlockSession(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ isLocked: false })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function isSessionValid(sessionId: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data: session, error }: { data: any, error: any } = await supabase
    .from('DeviceSession')
    .select('isLocked, loggedOutAt')
    .eq('id', sessionId)
    .limit(1)
    .maybeSingle();

  if (error || !session) return false;
  return !session.isLocked && !session.loggedOutAt;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ lastActivityAt: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function getAutoLockSetting(userId: string): Promise<boolean> {
  const resolution = await resolveAutoLockSetting(userId);
  return resolution.effectiveAutoLockFirstBrowser;
}

export async function setAutoLockSetting(userId: string, enabled: boolean): Promise<void> {
    const supabase = getSupabase();
    const { data: existing, error: getError }: { data: any, error: any } = await supabase
        .from('SessionLockSettings')
        .select('*')
        .eq('userId', userId)
        .limit(1)
        .maybeSingle();

    if (getError) throw getError;

    if (existing) {
        const { error } = await supabase
            .from('SessionLockSettings')
            // @ts-ignore: Supabase types expect never for update on untyped schema
            .update({ autoLockFirstBrowser: enabled })
            .eq('userId', userId);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('SessionLockSettings')
            .insert({ 
                id: crypto.randomUUID(), 
                userId, 
                autoLockFirstBrowser: enabled, 
                updatedAt: new Date().toISOString() 
            } as any);
        if (error) throw error;
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
  const supabase = getSupabase();
  const { data: setting, error }: { data: any, error: any } = await supabase
    .from('GlobalSessionLockSettings')
    .select('*')
    .eq('id', 'global')
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    autoLockFirstBrowser: setting?.autoLockFirstBrowser ?? true,
    allowDesktop: setting?.allowDesktop ?? true,
    allowTablet: setting?.allowTablet ?? true,
    allowMobile: setting?.allowMobile ?? true,
    maxConcurrentSessions: setting?.maxConcurrentSessions ?? 3,
  };
}

export async function setGlobalSessionSettings(settings: Partial<GlobalSessionSettings>): Promise<void> {
  const supabase = getSupabase();
  const { data: existing, error: getError }: { data: any, error: any } = await supabase
    .from('GlobalSessionLockSettings')
    .select('*')
    .eq('id', 'global')
    .limit(1)
    .maybeSingle();

  if (getError) throw getError;

  const updatedFields: any = {
    updatedAt: new Date().toISOString(),
  };
  if (settings.autoLockFirstBrowser !== undefined) updatedFields.autoLockFirstBrowser = settings.autoLockFirstBrowser;
  if (settings.allowDesktop !== undefined) updatedFields.allowDesktop = settings.allowDesktop;
  if (settings.allowTablet !== undefined) updatedFields.allowTablet = settings.allowTablet;
  if (settings.allowMobile !== undefined) updatedFields.allowMobile = settings.allowMobile;
  if (settings.maxConcurrentSessions !== undefined) updatedFields.maxConcurrentSessions = settings.maxConcurrentSessions;

  if (existing) {
    const { error } = await supabase
      .from('GlobalSessionLockSettings')
      // @ts-ignore: Supabase types expect never for update on untyped schema
      .update(updatedFields)
      .eq('id', 'global');
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('GlobalSessionLockSettings')
      .insert({
        id: 'global',
        autoLockFirstBrowser: settings.autoLockFirstBrowser ?? true,
        allowDesktop: settings.allowDesktop ?? true,
        allowTablet: settings.allowTablet ?? true,
        allowMobile: settings.allowMobile ?? true,
        maxConcurrentSessions: settings.maxConcurrentSessions ?? 3,
        updatedAt: new Date().toISOString(),
      } as any);
    if (error) throw error;
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
  const supabase = getSupabase();
  const [userRes, globalAutoLockFirstBrowser] = await Promise.all([
    supabase.from('SessionLockSettings').select('*').eq('userId', userId).limit(1).maybeSingle(),
    getGlobalAutoLockSetting(),
  ]) as any;

  if (userRes.error) throw userRes.error;
  const userSetting = userRes.data;

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
  const supabase = getSupabase();
  const { data, error }: { data: any, error: any } = await supabase.from('SessionLockSettings').select('*') as any;
  if (error) throw error;
  return data || [];
}

export async function terminateAllSessions(): Promise<void> {
  const supabase = getSupabase();
  // Only terminate sessions belonging to students (not admin/teacher)
  const { data: students, error: userError }: { data: any, error: any } = await supabase
    .from('User')
    .select('id')
    .eq('role', 'student');

  if (userError) throw userError;

  const studentIds = (students || []).map((s: any) => s.id);
  if (studentIds.length === 0) return;

  const { error } = await supabase
    .from('DeviceSession')
    // @ts-ignore: Supabase types expect never for update on untyped schema
    .update({ loggedOutAt: new Date().toISOString() })
    .is('loggedOutAt', null)
    .in('userId', studentIds);

  if (error) throw error;
}
