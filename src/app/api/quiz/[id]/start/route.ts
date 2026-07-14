import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, quizAttempt, question, quizQuestionMapping, quizCategory } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    
    const [rawQuiz] = await db.select().from(quiz).where(eq(quiz.id, id)).limit(1);
    let category = null;
    if (rawQuiz && rawQuiz.categoryId) {
      [category] = await db.select().from(quizCategory).where(eq(quizCategory.id, rawQuiz.categoryId)).limit(1);
    }
    const quizData = rawQuiz ? { ...rawQuiz, category: category || null } : null;
    
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
    
    const existingAttempts = await db.query.quizAttempt.findMany({
      where: and(eq(quizAttempt.quizId, id), eq(quizAttempt.studentId, studentId)),
      orderBy: (a, { desc }) => [desc(a.attemptNumber)],
    });
    
    let attemptNumber = 1;
    if (existingAttempts.length > 0) {
      const latestAttempt = existingAttempts[0];
      
      if (latestAttempt.status === 'in_progress') {
        return NextResponse.json({ 
          error: 'You already have an active attempt for this quiz.',
          attempt: latestAttempt,
        }, { status: 400 });
      }
      
      if (!quizData.allowMultipleAttempts) {
        return NextResponse.json({ error: 'Multiple attempts are not allowed for this quiz.' }, { status: 403 });
      }
      
      if (quizData.maxAttempts && latestAttempt.attemptNumber >= quizData.maxAttempts) {
        return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 403 });
      }
      
      attemptNumber = latestAttempt.attemptNumber + 1;
    }
    
    const inProgressAttempt = existingAttempts.find(a => a.status === 'in_progress');
    if (inProgressAttempt) {
      return NextResponse.json({ 
        error: 'You already have an active attempt.',
        attempt: inProgressAttempt,
      }, { status: 400 });
    }
    
    const allQuestions = await db.query.question.findMany({
      where: eq(question.quizId, id),
    });
    
    if (allQuestions.length === 0) {
      return NextResponse.json({ error: 'Quiz has no questions.' }, { status: 400 });
    }
    
    if (quizData.numQuestionsToServe > allQuestions.length) {
      return NextResponse.json({ error: 'Not enough questions in the quiz bank.' }, { status: 400 });
    }
    
    const shuffledQuestions = [...allQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffledQuestions.slice(0, quizData.numQuestionsToServe);
    
    const attemptId = crypto.randomUUID();
    const startedAt = new Date();
    
    await db.insert(quizAttempt).values({
      id: attemptId,
      quizId: id,
      studentId,
      startedAt: startedAt.toISOString(),
      attemptNumber,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    const mappings = selectedQuestions.map((q, index) => {
      const optionOrder = ['A', 'B', 'C', 'D'].sort(() => Math.random() - 0.5);
      return {
        id: crypto.randomUUID(),
        attemptId,
        questionId: q.id,
        displayOrder: index + 1,
        optionOrder: optionOrder,
      };
    });
    
    await db.insert(quizQuestionMapping).values(mappings);
    
    const questionsWithOptions = selectedQuestions.map((q, index) => {
      const mapping = mappings[index];
      const options = [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== '');
      
      const shuffledOptions = [...options].sort(() => Math.random() - 0.5);
      
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: shuffledOptions,
        displayOrder: index + 1,
        correctOption: q.correctOption,
        explanation: q.explanation,
      };
    });
    
    return NextResponse.json({
      attempt: {
        id: attemptId,
        quizId: id,
        studentId,
        startedAt,
        durationMinutes: quizData.durationMinutes,
        attemptNumber,
        numQuestions: quizData.numQuestionsToServe,
      },
      quiz: {
        id: quizData.id,
        title: quizData.title,
        description: quizData.description,
        instructions: quizData.instructions,
        durationMinutes: quizData.durationMinutes,
        marksPerCorrect: quizData.marksPerCorrect,
        allowNegativeMarking: quizData.allowNegativeMarking,
        negativeValue: quizData.negativeValue,
        shuffleQuestions: quizData.shuffleQuestions,
        shuffleOptions: quizData.shuffleOptions,
      },
      questions: questionsWithOptions,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/start error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}