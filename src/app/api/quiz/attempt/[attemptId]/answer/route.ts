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
    const { questionId, selectedOption } = body;

    if (!questionId || typeof questionId !== 'string') {
      return NextResponse.json({ error: 'questionId is required.' }, { status: 400 });
    }
    if (!selectedOption || typeof selectedOption !== 'string') {
      return NextResponse.json({ error: 'selectedOption is required.' }, { status: 400 });
    }

    const token = await extractCookieToken();


    const supabase = getSupabase(token);

    // Verify attempt belongs to this student and is in progress
    const { data: attempt, error: attemptError }: { data: any; error: any } = await supabase
      .from('QuizAttempt')
      .select('id, studentId, status, quizId')
      .eq('id', attemptId)
      .limit(1)
      .maybeSingle();

    if (attemptError) throw attemptError;
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    if (attempt.studentId !== payload.sub) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'This attempt is no longer active.' }, { status: 400 });
    }

    // Upsert the answer
    const { data: existingAnswer }: { data: any } = await supabase
      .from('AttemptAnswer')
      .select('id')
      .eq('attemptId', attemptId)
      .eq('questionId', questionId)
      .limit(1)
      .maybeSingle();

    const nowStr = new Date().toISOString();

    if (existingAnswer) {
      await supabase
        .from('AttemptAnswer')
        // @ts-ignore
        .update({ selectedOption, updatedAt: nowStr })
        .eq('id', existingAnswer.id);
    } else {
      await supabase.from('AttemptAnswer')
// @ts-ignore
.insert({
        id: nanoid(),
        attemptId,
        questionId,
        selectedOption,
        createdAt: nowStr,
        updatedAt: nowStr,
      } as any);
    }

    return NextResponse.json({ success: true, questionId, selectedOption });
  } catch (error: any) {
    console.error('[quiz/answer] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
