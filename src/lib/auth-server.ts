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
    
    // We are intentionally skipping the DB checks (`getSessionById` and `db.query.user.findFirst`)
    // here as well to ensure Cloudflare edge rendering doesn't exceed the 10ms CPU limit.
    // The session is completely stateless and relies purely on the JWT validity.

    return {
      user: {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
        phone: payload.user_metadata?.phone || null,
        user_metadata: {
          full_name: payload.user_metadata?.full_name || null,
          phone: payload.user_metadata?.phone || null,
          bmdc_number: payload.user_metadata?.bmdc_number || null,
          profile_image: payload.user_metadata?.profile_image || null,
          canManagePayments: payload.user_metadata?.canManagePayments || false,
        },
      },
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}
