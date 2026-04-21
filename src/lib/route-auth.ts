import { NextRequest } from 'next/server';
import {
  AuthTokenPayload,
  extractBearerToken,
  extractCookieToken,
  verifyAuthToken,
} from '@/lib/auth-server';

export async function getAuthPayload(request: NextRequest): Promise<AuthTokenPayload | null> {
  const bearerToken = extractBearerToken(request);
  const cookieToken = await extractCookieToken();
  const token = bearerToken || cookieToken;

  if (!token) {
    return null;
  }

  try {
    const payload = verifyAuthToken(token);
    
    // If the token has a sessionId, verify it is still valid in the database
    if (payload.sessionId) {
      const { isSessionValid } = await import('@/lib/session-manager');
      const sessionValid = await isSessionValid(payload.sessionId);
      if (!sessionValid) {
        return null; // Session has been revoked or logged out
      }
    }
    
    return payload;
  } catch {
    return null;
  }
}

export async function requireTeacherPayload(request: NextRequest): Promise<AuthTokenPayload | null> {
  const payload = await getAuthPayload(request);
  if (!payload) {
    return null;
  }

  if (payload.role !== 'teacher' && payload.role !== 'admin') {
    return null;
  }

  return payload;
}
