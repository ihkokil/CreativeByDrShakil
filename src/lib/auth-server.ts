import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export const AUTH_COOKIE_NAME = 'session_token';

export interface AuthTokenPayload extends JwtPayload {
  sub: string;
  role: 'admin' | 'teacher' | 'student';
  email: string;
  sessionId?: string;
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable.');
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAuthToken(payload: { sub: string; role: 'admin' | 'teacher' | 'student'; email: string; sessionId?: string }) {
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'],
  };

  return jwt.sign(payload, getJwtSecret() as jwt.Secret, options);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
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

export async function getSession() {
  const token = await extractCookieToken();
  if (!token) return null;

  try {
    const payload = verifyAuthToken(token);
    
    if (payload.sessionId) {
      const { isSessionValid } = await import('@/lib/session-manager');
      const sessionValid = await isSessionValid(payload.sessionId);
      if (!sessionValid) {
        return null; // Session has been revoked or logged out
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
