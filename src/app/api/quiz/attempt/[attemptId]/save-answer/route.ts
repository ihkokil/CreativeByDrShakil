import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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

    const supabase = getSupabaseAdmin();

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
    const questionIds = answersToSave.map((a: any) => a.questionId);

    // 1 single query to fetch all existing answers for these question IDs
    const { data: existingAnswers, error: fetchExistingError } = await supabase
      .from('AttemptAnswer')
      .select('id, questionId')
      .eq('attemptId', attemptId)
      .in('questionId', questionIds);

    if (fetchExistingError) throw fetchExistingError;

    const existingMap = new Map((existingAnswers || []).map((ea: any) => [ea.questionId, ea.id]));

    const toUpdate: { id: string; selectedOption: string | null }[] = [];
    const toInsert: { id: string; attemptId: string; questionId: string; selectedOption: string | null; createdAt: string }[] = [];

    for (const ans of answersToSave) {
      const qId = ans.questionId;
      const opt = ans.selectedOption;
      const existingId = existingMap.get(qId);

      if (existingId) {
        toUpdate.push({ id: existingId, selectedOption: opt || null });
      } else if (opt) {
        toInsert.push({
          id: nanoid(),
          attemptId,
          questionId: qId,
          selectedOption: opt,
          createdAt: nowStr,
        });
      }
    }

    const operations: Promise<any>[] = [];
    if (toInsert.length > 0) {
      operations.push(Promise.resolve(supabase.from('AttemptAnswer').insert(toInsert as any)));
    }
    for (const item of toUpdate) {
      operations.push(
        Promise.resolve(
          supabase.from('AttemptAnswer').update({ selectedOption: item.selectedOption }).eq('id', item.id)
        )
      );
    }

    if (operations.length > 0) {
      const opResults = await Promise.all(operations);
      for (const res of opResults) {
        if (res.error) throw res.error;
      }
    }

    const results = answersToSave.map((ans: any) => ({ questionId: ans.questionId, saved: true }));

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[quiz/save-answer] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
