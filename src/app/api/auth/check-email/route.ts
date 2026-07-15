import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSupabase } from '@/lib/db';

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

    const supabase = getSupabase();
    const { data: userRecord, error } = await supabase
      .from('User')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ exists: !!userRecord });
  } catch (error: any) {
    console.error('[Check Email Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
