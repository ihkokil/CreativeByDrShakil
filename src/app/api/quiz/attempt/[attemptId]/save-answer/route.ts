import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { attemptId } = await params;
    const body = await request.json();
    const { questionId, selectedOption, answers } = body;

    const answersToSave = answers || (questionId ? [{ questionId, selectedOption }] : []);

    if (!answersToSave || answersToSave.length === 0) {
      return NextResponse.json({ error: 'questionId or answers is required.' }, { status: 400 });
    }

    const token = await extractCookieToken();


    const supabase = getSupabase(token);

    // Verify attempt
    const { data: attempt }: { data: any } = await supabase
      .from('QuizAttempt')
      .select('id, studentId, status')
      .eq('id', attemptId)
      .limit(1)
      .maybeSingle();

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    if (attempt.studentId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Attempt is no longer active.' }, { status: 400 });
    }

    const nowStr = new Date().toISOString();
    const results = [];

    for (const ans of answersToSave) {
      const qId = ans.questionId;
      const opt = ans.selectedOption;
      
      const { data: existingAnswer }: { data: any } = await supabase
        .from('AttemptAnswer')
        .select('id')
        .eq('attemptId', attemptId)
        .eq('questionId', qId)
        .limit(1)
        .maybeSingle();

      if (existingAnswer) {
        const { error: updateError } = await supabase
          .from('AttemptAnswer')
          .update({ selectedOption: opt || null })
          .eq('id', existingAnswer.id);
        
        if (updateError) throw updateError;
      } else if (opt) {
        const { error: insertError } = await supabase.from('AttemptAnswer')
          .insert({
            id: nanoid(),
            attemptId,
            questionId: qId,
            selectedOption: opt,
            createdAt: nowStr,
          } as any);
        
        if (insertError) throw insertError;
      }
      
      results.push({ questionId: qId, saved: true });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[quiz/save-answer] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
