import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizAttempt, attemptAnswer, question, quiz, quizQuestionMapping } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    
    const attempt = await db.query.quizAttempt.findFirst({
      where: and(eq(quizAttempt.id, attemptId), eq(quizAttempt.studentId, studentId)),
      with: { quiz: true },
    });
    
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ 
        message: 'Attempt already submitted.',
        attempt,
      });
    }
    
    const mappings = await db.query.quizQuestionMapping.findMany({
      where: eq(quizQuestionMapping.attemptId, attemptId),
    });
    
    const answers = await db.query.attemptAnswer.findMany({
      where: eq(attemptAnswer.attemptId, attemptId),
    });
    
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    
    for (const mapping of mappings) {
      const answer = answers.find(a => a.questionId === mapping.questionId);
      if (answer && answer.selectedOption) {
        if (answer.isCorrect) correctCount++;
        else wrongCount++;
      } else {
        skippedCount++;
      }
    }
    
    const totalQuestions = mappings.length;
    const marksPerCorrect = attempt.quiz.marksPerCorrect;
    const allowNegative = attempt.quiz.allowNegativeMarking;
    const negativeValue = attempt.quiz.negativeValue;
    
    const correctScore = correctCount * marksPerCorrect;
    const negativeMarks = allowNegative ? wrongCount * negativeValue * marksPerCorrect : 0;
    const netScore = correctScore - negativeMarks;
    const maxScore = totalQuestions * marksPerCorrect;
    const percentageScore = maxScore > 0 ? (netScore / maxScore) * 100 : 0;
    
    const startedAtStr = attempt.startedAt;
    const startedAt = new Date(
      startedAtStr.endsWith('Z') || startedAtStr.includes('+') 
        ? startedAtStr 
        : startedAtStr + 'Z'
    );
    const timeTakenSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    
    await db.update(quizAttempt).set({
      status: 'auto_submitted',
      submittedAt: new Date().toISOString(),
      timeTakenSeconds,
      correctCount,
      wrongCount,
      skippedCount,
      totalScore: correctScore,
      negativeMarks,
      netScore,
      percentageScore,
      updatedAt: new Date().toISOString(),
    }).where(eq(quizAttempt.id, attemptId));
    
    const updatedAttempt = await db.query.quizAttempt.findFirst({
      where: eq(quizAttempt.id, attemptId),
    });
    
    const answersMap: Record<string, { selectedOption: string | null; isCorrect: boolean | null }> = {};
    for (const ans of answers) {
      answersMap[ans.questionId] = {
        selectedOption: ans.selectedOption,
        isCorrect: ans.isCorrect,
      };
    }

    return NextResponse.json({
      success: true,
      autoSubmitted: true,
      attempt: updatedAttempt,
      results: {
        totalQuestions,
        correctCount,
        wrongCount,
        skippedCount,
        correctScore,
        negativeMarks,
        netScore,
        percentageScore,
        timeTakenSeconds,
        answers: answersMap,
      },
    });
  } catch (error: any) {
    console.error('POST /api/quiz/attempt/[attemptId]/auto-submit error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}