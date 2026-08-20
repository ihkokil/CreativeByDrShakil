import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';

async function gradeAttemptForAutoSubmit(attemptId: string, quizId: string, supabase: any) {
  const { data: answers = [] } = await supabase
    .from('AttemptAnswer')
    .select('questionId, selectedOption')
    .eq('attemptId', attemptId);

  const { data: questions = [] } = await supabase
    .from('Question')
    .select('id, correctOption, questionType, optionA, optionB, optionC, optionD, optionE')
    .eq('quizId', quizId);

  const { data: quiz }: { data: any } = await supabase
    .from('Quiz')
    .select('marksPerCorrect, allowNegativeMarking, negativeValue, durationMinutes')
    .eq('id', quizId)
    .limit(1)
    .maybeSingle();

  const marksPerCorrect = Number(quiz?.marksPerCorrect) || 1;
  const allowNegativeMarking = quiz?.allowNegativeMarking ?? false;
  const negativeValue = allowNegativeMarking ? (Number(quiz?.negativeValue) || 0) : 0;
  const timeTakenSeconds = quiz?.durationMinutes ? quiz.durationMinutes * 60 : 0;
  
  const sbaMarks = marksPerCorrect;
  const sbaNegativeAbsolute = negativeValue;
  const tfMarks = marksPerCorrect / 5;
  const tfNegativeAbsolute = negativeValue / 5;

  const correctMap = new Map((questions || []).map((q: any) => [q.id, q.correctOption]));
  const answersMap = new Map((answers || []).map((a: any) => [a.questionId, a.selectedOption]));

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  
  let grossScore = 0;
  let penalty = 0;

  const answersReturn: Record<string, { isCorrect: boolean }> = {};

  for (const q of questions) {
    const qId = q.id;
    const correctOption = q.correctOption as string;
    const qType = q.questionType;
    const selected = answersMap.get(qId) as string;

    if (!selected) {
      unansweredCount++;
      answersReturn[qId] = { isCorrect: false };
      continue;
    }

    let isCorrect = false;

    if (qType === 'mcq') {
      let correctStems = 0;
      let incorrectStems = 0;
      const length = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE]
        .filter(o => o !== null && o !== undefined && String(o).trim() !== '').length || 5;
      
      for (let i = 0; i < length; i++) {
        const selChar = selected[i] || '-';
        if (selChar === correctOption[i]) {
          correctStems++;
        } else if (selChar !== '-' && selChar !== ' ') {
          incorrectStems++;
        }
      }
      
      if (correctStems === length) {
        correctCount++;
        isCorrect = true;
      }
      else if (incorrectStems > 0) {
        incorrectCount++;
      }
      
      grossScore += correctStems * tfMarks;
      penalty += incorrectStems * tfNegativeAbsolute;
    } else {
      if (selected === correctOption) {
        correctCount++;
        grossScore += sbaMarks;
        isCorrect = true;
      } else {
        incorrectCount++;
        penalty += sbaNegativeAbsolute;
      }
    }
    
    answersReturn[qId] = { isCorrect };
  }

  const totalQuestions = questions.length;
  const netScore = grossScore - penalty;
  
  // Calculate max possible score
  let maxScore = 0;
  for (const q of questions) {
    if (q.questionType === 'mcq') {
      const length = [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE]
        .filter(o => o !== null && o !== undefined && String(o).trim() !== '').length || 5;
      maxScore += length * tfMarks;
    } else {
      maxScore += sbaMarks;
    }
  }
  
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

  return { answers: answersReturn, correctCount, wrongCount: incorrectCount, skippedCount: unansweredCount, totalQuestions, netScore, percentageScore };
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
    const supabase = getSupabaseAdmin();

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
      results: result,
    });
  } catch (error: any) {
    console.error('[quiz/auto-submit] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
