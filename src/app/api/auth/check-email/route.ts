import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

// FREE TIER OPTIMIZATION: Real-time check (no caching) but optimized for fast execution
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

    // Use Drizzle execute to bypass schema building overhead while utilizing the pool
    // FREE TIER: Only select the ID column (minimal data fetch)
    const result = await db.execute(sql`SELECT id FROM "User" WHERE email = ${normalizedEmail} LIMIT 1`);

    return NextResponse.json({ exists: result.rows.length > 0 });
  } catch (error: any) {
    console.error('[Check Email Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
