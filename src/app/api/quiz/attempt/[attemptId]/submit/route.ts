import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';

async function gradeAttempt(attemptId: string, quizId: string, submissionStatus: 'submitted' | 'auto_submitted', supabase: any, timeTakenSeconds?: number) {
  // Fetch all answers for this attempt
  const { data: answers = [] } = await supabase
    .from('AttemptAnswer')
    .select('questionId, selectedOption')
    .eq('attemptId', attemptId);

  // Fetch all questions for this quiz
  const { data: questions = [] } = await supabase
    .from('Question')
    .select('id, correctOption, questionType')
    .eq('quizId', quizId);

  // Fetch quiz settings
  const { data: quiz }: { data: any } = await supabase
    .from('Quiz')
    .select('marksPerCorrect, allowNegativeMarking, negativeValue, sbaMarks, sbaNegative, tfMarks, tfNegative')
    .eq('id', quizId)
    .limit(1)
    .maybeSingle();

  const marksPerCorrect = quiz?.marksPerCorrect ?? 1;
  const allowNegativeMarking = quiz?.allowNegativeMarking ?? false;
  const negativeValue = quiz?.negativeValue ?? 0;
  
  const sbaMarks = quiz?.sbaMarks ?? marksPerCorrect;
  const sbaNegativePct = quiz?.sbaNegative ?? (allowNegativeMarking ? (negativeValue <= 1 && negativeValue > 0 ? negativeValue * 100 : negativeValue) : 0);
  const tfMarks = quiz?.tfMarks ?? (marksPerCorrect / 5);
  const tfNegativePct = quiz?.tfNegative ?? (allowNegativeMarking ? (negativeValue <= 1 && negativeValue > 0 ? negativeValue * 100 : negativeValue) : 0);
  
  const sbaNegativeAbsolute = sbaMarks * (sbaNegativePct / 100);
  const tfNegativeAbsolute = tfMarks * (tfNegativePct / 100);

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
      // Multiple True/False (e.g. "FFTFT")
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
      
      grossScore += correctStems * tfMarks;
      penalty += incorrectStems * tfNegativeAbsolute;
    } else {
      // sba (Best option selection [SBA])
      if (selected === correctOption) {
        correctCount++;
        grossScore += sbaMarks;
      } else {
        incorrectCount++;
        penalty += sbaNegativeAbsolute;
      }
    }
  }

  const totalQuestions = questions.length;
  const netScore = grossScore - penalty;
  
  // Calculate max possible score
  let maxScore = 0;
  for (const q of questions) {
    if (q.questionType === 'mcq') {
      const length = (q.correctOption as string)?.length || 5;
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
      status: submissionStatus,
      submittedAt: nowStr,
      correctCount,
      wrongCount: incorrectCount,
      skippedCount: unansweredCount,
      netScore,
      negativeMarks: penalty,
      timeTakenSeconds: timeTakenSeconds || 0,
      percentageScore,
      updatedAt: nowStr,
    })
    .eq('id', attemptId);

  if (updateError) throw updateError;

  return {
    correctCount,
    wrongCount: incorrectCount,
    skippedCount: unansweredCount,
    totalQuestions,
    netScore,
    percentageScore,
  };
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
      .select('id, studentId, status, quizId, createdAt')
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

    const timeTakenSeconds = attempt.createdAt ? Math.round((new Date().getTime() - new Date(attempt.createdAt).getTime()) / 1000) : 0;
    const result = await gradeAttempt(attemptId, attempt.quizId, 'submitted', supabase, timeTakenSeconds);

    return NextResponse.json({
      success: true,
      attemptId,
      ...result,
    });
  } catch (error: any) {
    console.error('[quiz/submit] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

