import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, question, quizAttempt, attemptAnswer, quizQuestionMapping } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const { id: quizId, attemptId } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    
    // Fetch attempt details along with the associated quiz
    const attempt = await db.query.quizAttempt.findFirst({
      where: and(
        eq(quizAttempt.id, attemptId),
        eq(quizAttempt.quizId, quizId),
        eq(quizAttempt.studentId, studentId)
      ),
      with: { quiz: true },
    });
    
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    
    // Fetch mappings for the questions in this attempt
    const mappings = await db.query.quizQuestionMapping.findMany({
      where: eq(quizQuestionMapping.attemptId, attemptId),
      orderBy: (m, { asc }) => [asc(m.displayOrder)],
      with: { question: true },
    });
    
    // Fetch existing answers saved for this attempt
    const existingAnswers = await db.query.attemptAnswer.findMany({
      where: eq(attemptAnswer.attemptId, attemptId),
    });
    
    // Construct mapped questions array maintaining optionOrder and displayOrder
    const mappedQuestions = mappings.map((m) => {
      const q = m.question;
      const originalOptions = [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== '');
      
      let orderedOptions = originalOptions;
      if (Array.isArray(m.optionOrder)) {
        orderedOptions = m.optionOrder.map((key) => {
          if (typeof key === 'number') {
            const letters = ['A', 'B', 'C', 'D'];
            const letter = letters[key];
            return originalOptions.find(o => o.letter === letter);
          } else if (typeof key === 'string') {
            return originalOptions.find(o => o.letter === key);
          }
          return null;
        }).filter(Boolean) as any[];
      }
      
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: orderedOptions,
        displayOrder: m.displayOrder,
        correctOption: q.correctOption,
        explanation: q.explanation,
      };
    });
    
    const nowServer = new Date();
    const startedAtStr = attempt.startedAt;
    const startedAt = new Date(
      startedAtStr.endsWith('Z') || startedAtStr.includes('+') 
        ? startedAtStr 
        : startedAtStr + 'Z'
    );
    const elapsedSeconds = Math.floor((nowServer.getTime() - startedAt.getTime()) / 1000);
    const timeRemaining = attempt.quiz.durationMinutes === 0 
      ? null 
      : Math.max(0, (attempt.quiz.durationMinutes * 60) - elapsedSeconds);

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        studentId: attempt.studentId,
        startedAt: attempt.startedAt,
        durationMinutes: attempt.quiz.durationMinutes,
        status: attempt.status,
        timeRemaining,
      },
      questions: mappedQuestions,
      existingAnswers: existingAnswers.map(a => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        isCorrect: a.isCorrect,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/attempt/[attemptId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
