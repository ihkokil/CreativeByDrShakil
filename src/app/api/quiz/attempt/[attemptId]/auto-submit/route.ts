import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { gradeAndPersistAttempt } from '@/lib/quiz-engine';

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
    const supabase = getSupabaseAdmin();

    const { data: attempt, error: attemptError } = await supabase
      .from('QuizAttempt')
      .select('id, studentId, status, quizId, startedAt')
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

    // If already submitted, return current state
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ success: true, message: 'Already submitted' });
    }

    const startTimeMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const timeTakenSeconds = Math.max(1, Math.round((Date.now() - startTimeMs) / 1000));

    const results = await gradeAndPersistAttempt(
      attemptId,
      attempt.quizId,
      'auto_submitted',
      supabase,
      timeTakenSeconds
    );

    return NextResponse.json({
      success: true,
      attemptId,
      results,
    });
  } catch (error: any) {
    console.error('[quiz/auto-submit] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
