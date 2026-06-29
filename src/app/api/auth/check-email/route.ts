import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { neon } from '@neondatabase/serverless';

export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 10);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const email = body.email;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Use raw Neon client to bypass Drizzle schema building overhead
    const sql = neon(process.env.NEON_DATABASE_URL!);
    const result = await sql`SELECT id FROM "User" WHERE email = ${normalizedEmail} LIMIT 1`;

    return NextResponse.json({ exists: result.length > 0 });
  } catch (error: any) {
    console.error('[Check Email Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
