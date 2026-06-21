import { NextRequest, NextResponse } from 'next/server';

/**
 * Google OAuth Initiation
 * 
 * GET /api/auth/[...nextauth] → Redirects to Google's OAuth consent screen.
 * This replaces the old NextAuth handler with a direct fetch()-based implementation
 * that is compatible with Cloudflare Workers (no Node.js `https.request` dependency).
 */

function getGoogleOAuthURL() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || 'http://localhost:3000';
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
    const url = getGoogleOAuthURL();
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('[Google OAuth] Failed to initiate:', error);
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${appUrl}/login?error=OAuthInitFailed`);
  }
}

export async function POST(request: NextRequest) {
  // POST is used by the old NextAuth signIn() — redirect to GET
  return GET(request);
}
