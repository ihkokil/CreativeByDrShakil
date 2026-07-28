import { NextRequest, NextResponse } from 'next/server';

/**
 * Google OAuth Initiation
 * 
 * GET /api/auth/[...nextauth] → Redirects to Google's OAuth consent screen.
 * This replaces the old NextAuth handler with a direct fetch()-based implementation
 * that is compatible with Cloudflare Workers (no Node.js `https.request` dependency).
 */

function getAppUrl(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || (request.nextUrl.protocol === 'https:' ? 'https' : 'http');
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;

  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || origin;
}

function getGoogleOAuthURL(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = getAppUrl(request);
  const redirectUri = `${appUrl}/api/auth/google-callback`;

  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  try {
    const url = getGoogleOAuthURL(request);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('[Google OAuth] Failed to initiate:', error);
    const appUrl = getAppUrl(request);
    return NextResponse.redirect(`${appUrl}/?auth=login&error=OAuthInitFailed`);
  }
}

export async function POST(request: NextRequest) {
  // POST is used by the old NextAuth signIn() — redirect to GET
  return GET(request);
}
