import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define the public paths that do not require authentication
const publicPaths = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google-callback',
  '/api/auth/logout',
  '/api/auth/reset-password',
  '/api/auth/session',
  '/api/auth/check-email',
  '/api/public',
  '/api/webhooks',
  '/api/courses',
  '/api/teachers',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // We only intercept /api routes (as defined in matcher)
  
  // Skip authentication for public routes
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Extract the token
  const authHeader = request.headers.get('authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    token = request.cookies.get('session_token')?.value;
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    let secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('Missing JWT_SECRET');
    }
    if (secret.length < 32) {
      secret = secret.padEnd(32, '_');
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    // CRITICAL SECURITY FIX: Block banned users at the edge
    if (payload.isBanned === true) {
      return NextResponse.json(
        { error: 'You have been banned from this site. Please contact the administrator.' },
        { status: 403 }
      );
    }

    // SESSION HIJACKING PREVENTION / DEVICE HASH CHECKS
    const isPrivileged = payload.role === 'admin' || payload.role === 'teacher';
    const isExempt = !!payload.isSessionLockedExempt || isPrivileged;

    if (!isExempt) {
      const clientDeviceHash = request.headers.get('x-device-hash');
      
      // If the client sent a hash and it doesn't match the one in the token, block it.
      // This strictly enforces mismatch checks for hijacking attempts where the client
      // provides a device fingerprint that doesn't match the token's original fingerprint.
      if (clientDeviceHash && payload.deviceHash && clientDeviceHash !== payload.deviceHash) {
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

// Only match API routes, exclude next static assets, images, webhooks, etc.
export const config = {
  matcher: ['/api/:path*'],
};
