import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, question, quizCategory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const [existingQuizRow] = await db.select().from(quiz).where(eq(quiz.id, id)).limit(1);
    let existingQuizQuestions: (typeof question.$inferSelect)[] = [];
    if (existingQuizRow) {
      existingQuizQuestions = await db.select().from(question).where(eq(question.quizId, id));
    }
    const existingQuiz = existingQuizRow ? { ...existingQuizRow, questions: existingQuizQuestions } : null;
    
    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to duplicate this quiz.' }, { status: 403 });
    }
    
    const newQuizId = nanoid();
    const now = new Date();
    
    const nowStr = now.toISOString();
    const insertValues = {
      id: newQuizId,
      title: `${existingQuiz.title} (Copy)`,
      description: existingQuiz.description,
      instructions: existingQuiz.instructions,
      categoryId: existingQuiz.categoryId,
      durationMinutes: existingQuiz.durationMinutes,
      numQuestionsToServe: existingQuiz.numQuestionsToServe,
      positionType: existingQuiz.positionType,
      allowMultipleAttempts: existingQuiz.allowMultipleAttempts,
      maxAttempts: existingQuiz.maxAttempts,
      allowNegativeMarking: existingQuiz.allowNegativeMarking,
      negativeValue: existingQuiz.negativeValue,
      marksPerCorrect: existingQuiz.marksPerCorrect,
      startDatetime: null,
      endDatetime: null,
      status: 'draft' as const,
      shuffleQuestions: existingQuiz.shuffleQuestions,
      shuffleOptions: existingQuiz.shuffleOptions,
      createdBy: payload.sub,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await db.insert(quiz).values(insertValues);

    const newQuiz = {
      ...insertValues,
      publishedAt: null,
    };
    
    for (const q of existingQuiz.questions) {
      await db.insert(question).values({
        id: nanoid(),
        quizId: newQuizId,
        questionText: q.questionText,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanation: q.explanation,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
    
    return NextResponse.json({ quiz: newQuiz }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/duplicate error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}