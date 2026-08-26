import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the public API paths that do not require authentication
const publicPaths = [
  '/api/auth',
  '/api/public',
  '/api/webhooks',
  '/api/telegram',
  '/api/courses',
  '/api/teachers',
];

// Guest-only auth pages that logged-in users should not access
const authPagePaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/auth/forgot-password',
];

function getDestinationForRole(role?: string | null): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'teacher') return '/teacher/dashboard';
  return '/dashboard/courses';
}

function getJwtSecret(): Uint8Array {
  let secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET');
  }
  if (secret.length < 32) {
    secret = secret.padEnd(32, '_');
  }
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract the token (header or cookie)
  const authHeader = request.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = request.cookies.get('session_token')?.value || null;
  }

  // Handle Guest-Only Auth Pages (/login, /register, /forgot-password, /auth/forgot-password)
  const isAuthPage = authPagePaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  );

  if (isAuthPage) {
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        if (payload && payload.isBanned !== true) {
          const destination = getDestinationForRole(payload.role as string);
          return NextResponse.redirect(new URL(destination, request.url));
        }
      } catch {
        // Invalid or expired token; proceed to auth page
      }
    }
    return NextResponse.next();
  }

  // Skip authentication for public API routes
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Handle Protected API Routes
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());

    // CRITICAL SECURITY FIX: Block banned users at the edge
    if (payload.isBanned === true) {
      return NextResponse.json(
        {
          error:
            'You have been banned from accessing the platform. Please contact Dr. Nahid Akhter Shakil or email support@creativebydrshakil.com.',
          code: 'user_banned',
        },
        { status: 403 }
      );
    }

    // SESSION HIJACKING PREVENTION / DEVICE HASH CHECKS
    const isPrivileged = payload.role === 'admin' || payload.role === 'teacher';
    const isExempt = !!payload.isSessionLockedExempt || isPrivileged;

    if (!isExempt) {
      const clientDeviceHash = request.headers.get('x-device-hash');
      const isFallbackJwt = typeof payload.deviceHash === 'string' && (payload.deviceHash.startsWith('fallback-') || !payload.deviceHash);
      const isFallbackClient = typeof clientDeviceHash === 'string' && (clientDeviceHash.startsWith('fallback-') || !clientDeviceHash);

      if (
        clientDeviceHash &&
        payload.deviceHash &&
        !isFallbackJwt &&
        !isFallbackClient &&
        clientDeviceHash !== payload.deviceHash
      ) {
        return NextResponse.json(
          { error: 'Session hijacking detected. Invalid device hash.', code: 'invalid_device_hash' },
          { status: 401 }
        );
      }
    }

    // Success, continue with the request
    return NextResponse.next();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized or token expired.' }, { status: 401 });
  }
}

// Intercept API routes and Guest-only Auth Pages
export const config = {
  matcher: [
    '/api/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/auth/forgot-password',
  ],
};
