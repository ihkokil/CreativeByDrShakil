import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';

async function gradeAttemptForAutoSubmit(attemptId: string, quizId: string, supabase: any) {
  const { data: answers = [] } = await supabase
    .from('AttemptAnswer')
    .select('questionId, selectedOption')
    .eq('attemptId', attemptId);

  const { data: questions = [] } = await supabase
    .from('Question')
    .select('id, correctOption, questionType')
    .eq('quizId', quizId);

  const { data: quiz }: { data: any } = await supabase
    .from('Quiz')
    .select('marksPerCorrect, allowNegativeMarking, negativeValue, durationMinutes')
    .eq('id', quizId)
    .limit(1)
    .maybeSingle();

  const marksPerCorrect = quiz?.marksPerCorrect ?? 1;
  const allowNegativeMarking = quiz?.allowNegativeMarking ?? false;
  const negativeValue = quiz?.negativeValue ?? 0;
  const timeTakenSeconds = quiz?.durationMinutes ? quiz.durationMinutes * 60 : 0;

  const correctMap = new Map((questions || []).map((q: any) => [q.id, q.correctOption]));
  const answersMap = new Map((answers || []).map((a: any) => [a.questionId, a.selectedOption]));

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  
  let grossScore = 0;
  let penalty = 0;

  for (const q of questions) {
    const qId = q.id;
    const correctOption = q.correctOption as string;
    const qType = q.questionType;
    const selected = answersMap.get(qId) as string;

    if (!selected) {
      unansweredCount++;
      continue;
    }

    if (qType === 'mcq') {
      let correctStems = 0;
      let incorrectStems = 0;
      const length = correctOption.length || 5;
      
      for (let i = 0; i < length; i++) {
        const selChar = selected[i] || '-';
        if (selChar === correctOption[i]) {
          correctStems++;
        } else if (selChar !== '-' && selChar !== ' ') {
          incorrectStems++;
        }
      }
      
      if (correctStems === length) correctCount++;
      else if (incorrectStems > 0) incorrectCount++;
      
      grossScore += (correctStems / length) * marksPerCorrect;
      if (allowNegativeMarking) {
        const percentage = negativeValue <= 1 && negativeValue > 0 ? negativeValue : negativeValue / 100;
        const marksPerStem = marksPerCorrect / length;
        penalty += incorrectStems * (marksPerStem * percentage);
      }
    } else {
      if (selected === correctOption) {
        correctCount++;
        grossScore += marksPerCorrect;
      } else {
        incorrectCount++;
        if (allowNegativeMarking) {
          const percentage = negativeValue <= 1 && negativeValue > 0 ? negativeValue : negativeValue / 100;
          penalty += marksPerCorrect * percentage;
        }
      }
    }
  }

  const totalQuestions = questions.length;
  const netScore = grossScore - penalty;
  const maxScore = totalQuestions * marksPerCorrect;
  const percentageScore = maxScore > 0 ? Math.round((Math.max(0, netScore) / maxScore) * 100) : 0;

  const nowStr = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('QuizAttempt')
    // @ts-ignore
    .update({
      status: 'auto_submitted',
      submittedAt: nowStr,
      correctCount,
      wrongCount: incorrectCount,
      skippedCount: unansweredCount,
      netScore,
      negativeMarks: penalty,
      timeTakenSeconds: timeTakenSeconds,
      percentageScore,
      updatedAt: nowStr,
    })
    .eq('id', attemptId);

  if (updateError) throw updateError;

  return { correctCount, wrongCount: incorrectCount, skippedCount: unansweredCount, totalQuestions, netScore, percentageScore };
}

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
    const token = await extractCookieToken();

    const supabase = getSupabase(token);

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
      return NextResponse.json({ error: 'This attempt has already been submitted.' }, { status: 400 });
    }

    const result = await gradeAttemptForAutoSubmit(attemptId, attempt.quizId, supabase);

    return NextResponse.json({
      success: true,
      attemptId,
      autoSubmitted: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[quiz/auto-submit] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
