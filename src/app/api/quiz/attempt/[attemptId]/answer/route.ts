import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quizAttempt, attemptAnswer, question, quiz, quizQuestionMapping } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

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
    const body = await request.json();
    const { questionId, selectedOption } = body;
    
    if (!questionId) {
      return NextResponse.json({ error: 'Question ID is required.' }, { status: 400 });
    }
    
    const attempt = await db.query.quizAttempt.findFirst({
      where: and(eq(quizAttempt.id, attemptId), eq(quizAttempt.studentId, studentId)),
      with: { quiz: true },
    });
    
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Quiz attempt is no longer active.' }, { status: 400 });
    }
    
    const startedAtStr = attempt.startedAt;
    const startedAt = new Date(
      startedAtStr.endsWith('Z') || startedAtStr.includes('+') 
        ? startedAtStr 
        : startedAtStr + 'Z'
    );
    const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    const maxSeconds = attempt.quiz.durationMinutes * 60;
    if (maxSeconds > 0 && elapsedSeconds >= maxSeconds) {
      return NextResponse.json({ error: 'Time has expired.' }, { status: 400 });
    }
    
    const questionData = await db.query.question.findFirst({
      where: eq(question.id, questionId),
    });
    
    if (!questionData) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    
    const mapping = await db.query.quizQuestionMapping.findFirst({
      where: and(
        eq(quizQuestionMapping.attemptId, attemptId),
        eq(quizQuestionMapping.questionId, questionId)
      ),
    });
    
    if (!mapping) {
      return NextResponse.json({ error: 'Question not part of this attempt.' }, { status: 404 });
    }
    
    const existingAnswer = await db.query.attemptAnswer.findFirst({
      where: and(
        eq(attemptAnswer.attemptId, attemptId),
        eq(attemptAnswer.questionId, questionId)
      ),
    });
    
    if (existingAnswer) {
      return NextResponse.json({ 
        error: 'Answer already submitted for this question. Answers are locked once selected.',
        locked: true,
        existingAnswer: existingAnswer.selectedOption,
      }, { status: 400 });
    }
    
    const isCorrect = selectedOption ? selectedOption === questionData.correctOption : false;
    
    await db.insert(attemptAnswer).values({
      id: nanoid(),
      attemptId,
      questionId,
      selectedOption: selectedOption || null,
      isCorrect,
      createdAt: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      isCorrect,
      correctOption: questionData.correctOption,
    });
  } catch (error: any) {
    console.error('POST /api/quiz/attempt/[attemptId]/answer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}