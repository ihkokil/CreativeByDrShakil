import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

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

    // Use Drizzle to find if the user exists
    // FREE TIER: Only select the ID column (minimal data fetch)
    const result = await db.query.users.findFirst({
      where: eq(schema.users.email, normalizedEmail),
      columns: { id: true },
    });

    return NextResponse.json({ exists: !!result });
  } catch (error: any) {
    console.error('[Check Email Error]', error?.message || error);
    return NextResponse.json(
      { 
        error: 'Something went wrong. Please try again later.',
        debug_message: error?.message,
        debug_stack: error?.stack 
      },
      { status: 500 }
    );
  }
}
