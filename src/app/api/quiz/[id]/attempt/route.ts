import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, question, quizAttempt, attemptAnswer, quizQuestionMapping, user } from '@/db/schema';
import { eq, and, sql, count } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { shuffleArray } from '@/lib/shuffle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    
    const quizData = await db.query.quiz.findFirst({
      where: eq(quiz.id, quizId),
      with: { questions: true },
    });
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (quizData.status !== 'published') {
      return NextResponse.json({ error: 'Quiz is not available.' }, { status: 403 });
    }
    
    const now = new Date();
    if (quizData.startDatetime && new Date(quizData.startDatetime) > now) {
      return NextResponse.json({ error: 'Quiz has not started yet.' }, { status: 403 });
    }
    if (quizData.endDatetime && new Date(quizData.endDatetime) < now) {
      return NextResponse.json({ error: 'Quiz has ended.' }, { status: 403 });
    }
    
    const existingAttempt = await db.query.quizAttempt.findFirst({
      where: and(
        eq(quizAttempt.quizId, quizId),
        eq(quizAttempt.studentId, studentId),
        eq(quizAttempt.status, 'in_progress')
      ),
      orderBy: (a, { desc }) => [desc(a.startedAt)],
    });
    
    if (existingAttempt) {
      const mappings = await db.query.quizQuestionMapping.findMany({
        where: eq(quizQuestionMapping.attemptId, existingAttempt.id),
        with: { question: true },
      });
      
      const answers = await db.query.attemptAnswer.findMany({
        where: eq(attemptAnswer.attemptId, existingAttempt.id),
      });
      
      const answerMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));
      
      return NextResponse.json({
        attempt: existingAttempt,
        questions: mappings.map(m => ({
          ...m.question,
          displayOrder: m.displayOrder,
          optionOrder: m.optionOrder,
          selectedOption: answerMap.get(m.questionId) || null,
        })),
        remainingTimeSeconds: Math.max(0, quizData.durationMinutes * 60 - Math.floor((Date.now() - new Date(existingAttempt.startedAt).getTime()) / 1000)),
      });
    }
    
    const attemptCountResult = await db.select({ count: count() })
      .from(quizAttempt)
      .where(and(eq(quizAttempt.quizId, quizId), eq(quizAttempt.studentId, studentId)));
    const attemptCount = attemptCountResult[0]?.count || 0;
    
    if (!quizData.allowMultipleAttempts && attemptCount > 0) {
      return NextResponse.json({ error: 'You have already attempted this quiz.' }, { status: 403 });
    }
    
    if (quizData.maxAttempts && attemptCount >= quizData.maxAttempts) {
      return NextResponse.json({ error: `Maximum attempts (${quizData.maxAttempts}) reached.` }, { status: 403 });
    }
    
    const availableQuestions = quizData.questions;
    if (availableQuestions.length < quizData.numQuestionsToServe) {
      return NextResponse.json({ error: 'Not enough questions in the quiz bank.' }, { status: 500 });
    }
    
    const shuffledQuestions = shuffleArray([...availableQuestions]);
    const selectedQuestions = shuffledQuestions.slice(0, quizData.numQuestionsToServe);
    
    const attemptId = nanoid();
    const startedAt = new Date();
    
    const insertValues = {
      id: attemptId,
      quizId,
      studentId,
      startedAt: startedAt.toISOString(),
      status: 'in_progress' as const,
      attemptNumber: attemptCount + 1,
      createdAt: startedAt.toISOString(),
      updatedAt: startedAt.toISOString(),
    };

    await db.insert(quizAttempt).values(insertValues);

    const newAttempt = {
      ...insertValues,
      submittedAt: null,
      timeTakenSeconds: null,
      isAutoSubmitted: false,
      totalScore: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      negativeMarks: 0,
      netScore: 0,
      percentageScore: 0,
      rank: null,
    };
    
    const mappings = selectedQuestions.map((q, index) => {
      const options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);
      const optionOrder = quizData.shuffleOptions ? shuffleArray(options.map((_, i) => i)) : options.map((_, i) => i);
      
      return {
        id: nanoid(),
        attemptId,
        questionId: q.id,
        displayOrder: index + 1,
        optionOrder,
      };
    });
    
    await db.insert(quizQuestionMapping).values(mappings);
    
    return NextResponse.json({
      attempt: newAttempt,
      questions: mappings.map(m => ({
        ...selectedQuestions.find(q => q.id === m.questionId)!,
        displayOrder: m.displayOrder,
        optionOrder: m.optionOrder,
        selectedOption: null,
      })),
      remainingTimeSeconds: quizData.durationMinutes * 60,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/attempt error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}