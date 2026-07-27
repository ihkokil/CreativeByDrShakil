import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('Question')
      .select('questionText, optionA, optionB, optionC, optionD, optionE, correctOption')
      .eq('quizId', 'X9t5HsQU_bM2neVQOCrKP')
      .order('createdAt', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
