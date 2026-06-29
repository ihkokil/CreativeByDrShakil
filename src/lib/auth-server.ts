import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const AUTH_COOKIE_NAME = 'session_token';

export interface AuthTokenPayload extends JWTPayload {
  sub: string;
  role: 'admin' | 'teacher' | 'student';
  email: string;
  sessionId?: string;
  user_metadata?: {
    full_name: string | null;
    phone: string | null;
    bmdc_number: string | null;
    profile_image: string | null;
    canManagePayments?: boolean;
  };
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable.');
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function signAuthToken(payload: { sub: string; role: 'admin' | 'teacher' | 'student'; email: string; sessionId?: string; user_metadata?: any }) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return payload as AuthTokenPayload;
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export async function extractCookieToken() {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value || null;
}

import { headers } from 'next/headers';

export async function getSession() {
  const token = await extractCookieToken();
  if (!token) return null;

  try {
    const payload = await verifyAuthToken(token);
    
    if (payload.sessionId) {
      const { getSessionById, updateSessionDeviceHash } = await import('@/lib/session-manager');
      const session = await getSessionById(payload.sessionId);
      if (!session || session.isLocked || session.loggedOutAt) {
        return null; // Session has been revoked or logged out
      }

      try {
        const { db } = await import('@/lib/db');
        const userRecord = await db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, session.userId),
          columns: { role: true, isSessionLockedExempt: true }
        });
        const isPrivilegedRole = userRecord?.role === 'admin' || userRecord?.role === 'teacher';
        const isExempt = isPrivilegedRole || !!userRecord?.isSessionLockedExempt;

        // Enforce device category restrictions (students only)
        if (!isPrivilegedRole) {
          try {
            const { getGlobalSessionSettings } = await import('@/lib/session-manager');
            const globalSettings = await getGlobalSessionSettings();
            if (session.deviceType === 'desktop' && !globalSettings.allowDesktop) return null;
            if (session.deviceType === 'tablet' && !globalSettings.allowTablet) return null;
            if (session.deviceType === 'mobile' && !globalSettings.allowMobile) return null;
          } catch (err) {
            // bypass lookup failure gracefully
          }
        }

        const headerStore = await headers();
        const incomingHash = headerStore.get('x-device-hash');
        
        if (incomingHash && !isExempt) {
          if (!session.deviceHash) {
            // Graceful migration: save device hash on first use
            await updateSessionDeviceHash(session.id, incomingHash);
          } else if (session.deviceHash !== incomingHash) {
            // Device mismatch!
            return null;
          }
        }
      } catch (err) {
        // db lookup or headers() might fail or not be available in some edge environments, bypass gracefully
      }
    }

    return {
      user: {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      },
    };
  } catch {
    return null;
  }
}
