import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Global Middleware for CreativeByDrShakil
 * Handles central route protection and authentication redirects.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    
    // 1. Specify protected routes
    const isDashboardPath = pathname.startsWith('/dashboard');
    const isTeacherPath = pathname.startsWith('/teacher');
    const isAdminPath = pathname.startsWith('/admin');
    const isStudyPath = pathname.startsWith('/study');
    
    const isProtected = isDashboardPath || isTeacherPath || isAdminPath || isStudyPath;

    if (!isProtected) {
        return NextResponse.next();
    }

    // 2. Check for the session cookie
    // Note: We use 'session_token' as defined in src/lib/auth-server.ts
    const sessionToken = request.cookies.get('session_token')?.value;

    if (!sessionToken) {
        // Redirect to login if trying to access protected content
        const loginUrl = new URL('/', request.url);
        loginUrl.searchParams.set('auth', 'login');
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 3. Optional: Basic role-based prefix check logic could go here
    // But since we can't verify JWT easily without 'jose' in Edge, 
    // we rely on the Page/API level 'requireAdmin' / 'requireTeacher' checks 
    // for deep authorization. The middleware act as the first gate.

    return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> Handled internally by API middleware logic
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public (public assets)
         */
        '/dashboard/:path*',
        '/teacher/:path*',
        '/admin/:path*',
        '/study/:path*',
    ],
};
