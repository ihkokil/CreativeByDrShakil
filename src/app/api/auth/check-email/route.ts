import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';

const checkEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// FREE TIER OPTIMIZATION: Real-time check (no caching) but optimized for fast execution
export async function POST(request: NextRequest) {
  try {
    const rateLimitError = await checkRateLimit(request, 10);
    if (rateLimitError) return rateLimitError;

    const body = await request.json();
    const parsed = checkEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // FREE TIER: Only select the ID column (minimal data fetch)
    const user = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, normalizedEmail),
      columns: {
        id: true,
      },
    });

    return NextResponse.json({ exists: !!user });
  } catch (error: any) {
    console.error('[Check Email Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
