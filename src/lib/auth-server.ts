import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies, headers } from 'next/headers';
import { NextRequest } from 'next/server';

export const AUTH_COOKIE_NAME = 'session_token';

export interface AuthTokenPayload extends JWTPayload {
  sub: string;
  role: 'admin' | 'teacher' | 'student';
  email: string;
  sessionId?: string;
  isBanned?: boolean;
  isSessionLockedExempt?: boolean;
  deviceHash?: string;
  user_metadata?: {
    full_name: string | null;
    phone: string | null;
    bmdc_number: string | null;
    profile_image: string | null;
    canManagePayments?: boolean;
  };
}

function getJwtSecret(): Uint8Array {
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET environment variable.');
  }
  if (secret.length < 32) {
    secret = secret.padEnd(32, '_');
  }
  return new TextEncoder().encode(secret);
}


export async function signAuthToken(payload: { 
  sub: string; 
  role: 'admin' | 'teacher' | 'student'; 
  email: string; 
  sessionId?: string; 
  isBanned?: boolean;
  isSessionLockedExempt?: boolean;
  deviceHash?: string;
  user_metadata?: any 
}) {
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
  let token = cookieStore.get(AUTH_COOKIE_NAME)?.value || null;

  if (!token) {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  return token;
}

export async function getSession() {
  const token = await extractCookieToken();

  if (!token) return null;

  try {
    const payload = await verifyAuthToken(token);
    
    if (payload.sessionId) {
      const { isSessionValid } = await import('@/lib/session-manager');
      const headersList = await headers();
      const xDeviceHash = headersList.get('x-device-hash');
      const sessionValid = await isSessionValid(payload.sessionId, payload.sub, xDeviceHash);
      if (!sessionValid) return null;
    }

    const { getSupabaseAdmin } = await import('./db');
    const supabase = getSupabaseAdmin();
    
    const { data: userRecord, error }: { data: any, error: any } = await supabase
      .from('User')
      .select('*')
      .eq('id', payload.sub)
      .maybeSingle();

    if (error || !userRecord || userRecord.isBanned) return null;

    return {
      user: {
        id: userRecord.id,
        role: userRecord.role,
        email: userRecord.email,
        phone: userRecord.phone || null,
        user_metadata: {
          full_name: userRecord.fullName || null,
          phone: userRecord.phone || null,
          bmdc_number: userRecord.bmdcNumber || null,
          profile_image: userRecord.profileImage || null,
          canManagePayments: userRecord.canManagePayments || false,
        },
      },
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}
