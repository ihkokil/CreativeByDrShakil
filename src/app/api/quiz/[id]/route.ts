import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, quizCategory, question, quizAttempt, user, attemptAnswer } from '@/db/schema';
import { eq, and, or, ilike, sql, inArray, count, desc, asc } from 'drizzle-orm';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    const isTeacher = payload && (payload.role === 'teacher' || payload.role === 'admin');
    
    const quizData = await db.query.quiz.findFirst({
      where: eq(quiz.id, id),
      with: {
        category: true,
        creator: { columns: { id: true, fullName: true } },
        questions: {
          orderBy: (q, { asc }) => [asc(q.createdAt)],
        },
      },
    });
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (!isTeacher) {
      if (quizData.status !== 'published') {
        return NextResponse.json({ error: 'Quiz not available.' }, { status: 404 });
      }
      
      const now = new Date();
      if (quizData.startDatetime && new Date(quizData.startDatetime) > now) {
        return NextResponse.json({ error: 'Quiz has not started yet.' }, { status: 403 });
      }
      if (quizData.endDatetime && new Date(quizData.endDatetime) < now) {
        return NextResponse.json({ error: 'Quiz has ended.' }, { status: 403 });
      }
    } else if (payload.role === 'teacher' && quizData.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to view this quiz.' }, { status: 403 });
    }
    
    let attempt = null;
    if (payload && payload.role === 'student') {
      attempt = await db.query.quizAttempt.findFirst({
        where: and(
          eq(quizAttempt.quizId, id),
          eq(quizAttempt.studentId, payload.sub)
        ),
        orderBy: (a, { desc }) => [desc(a.startedAt)],
        with: {
          answers: true,
          questionMappings: true,
        },
      });
    }
    
    const questionsWithOptions = quizData.questions.map(q => ({
      ...q,
      options: [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== ''),
    }));
    
    return NextResponse.json({
      quiz: {
        ...quizData,
        questions: questionsWithOptions,
      },
      attempt: attempt ? {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        answers: attempt.answers.map(a => ({ questionId: a.questionId, selectedOption: a.selectedOption })),
        questionMappings: attempt.questionMappings.map(m => ({
          questionId: m.questionId,
          displayOrder: m.displayOrder,
          optionOrder: m.optionOrder,
        })),
      } : null,
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const existingQuiz = await db.query.quiz.findFirst({ where: eq(quiz.id, id) });
    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to edit this quiz.' }, { status: 403 });
    }
    
    const hasAttempts = await db.query.quizAttempt.findFirst({
      where: eq(quizAttempt.quizId, id),
      columns: { id: true },
    });
    
    const body = await request.json();
    const {
      title,
      description,
      instructions,
      categoryId,
      durationMinutes,
      numQuestionsToServe,
      positionType,
      allowMultipleAttempts,
      maxAttempts,
      allowNegativeMarking,
      negativeValue,
      marksPerCorrect,
      startDatetime,
      endDatetime,
      shuffleQuestions,
      shuffleOptions,
      status,
      questions,
    } = body;
    
    if (title !== undefined && !title) {
      return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
    }
    
    if (categoryId !== undefined && categoryId) {
      const category = await db.query.quizCategory.findFirst({ where: eq(quizCategory.id, categoryId) });
      if (!category) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
    }
    
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (numQuestionsToServe !== undefined) updateData.numQuestionsToServe = numQuestionsToServe;
    if (positionType !== undefined) updateData.positionType = positionType;
    if (allowMultipleAttempts !== undefined) updateData.allowMultipleAttempts = allowMultipleAttempts;
    if (maxAttempts !== undefined) updateData.maxAttempts = maxAttempts === 0 ? null : maxAttempts;
    if (allowNegativeMarking !== undefined) updateData.allowNegativeMarking = allowNegativeMarking;
    if (negativeValue !== undefined) updateData.negativeValue = negativeValue;
    if (marksPerCorrect !== undefined) updateData.marksPerCorrect = marksPerCorrect;
    if (startDatetime !== undefined) updateData.startDatetime = startDatetime ? new Date(startDatetime).toISOString() : null;
    if (endDatetime !== undefined) updateData.endDatetime = endDatetime ? new Date(endDatetime).toISOString() : null;
    if (shuffleQuestions !== undefined) updateData.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions !== undefined) updateData.shuffleOptions = shuffleOptions;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'published' && existingQuiz.status !== 'published') {
        updateData.publishedAt = new Date().toISOString();
      }
    }
    
    const [updatedQuiz] = await db.update(quiz)
      .set(updateData)
      .where(eq(quiz.id, id))
      .returning();
      
    if (questions && Array.isArray(questions)) {
      const existingQuestions = await db.query.question.findMany({
        where: eq(question.quizId, id),
      });
      const existingQuestionIds = new Set(existingQuestions.map(q => q.id));

      const payloadQuestionIds = new Set(
        questions
          .map(q => q.id)
          .filter(qId => qId && !qId.startsWith('temp-'))
      );

      const questionsToDelete = existingQuestions.filter(q => !payloadQuestionIds.has(q.id));
      if (questionsToDelete.length > 0) {
        await db.delete(question).where(
          inArray(question.id, questionsToDelete.map(q => q.id))
        );
      }

      const nowStr = new Date().toISOString();
      for (const q of questions) {
        const questionData = {
          questionText: q.questionText.trim(),
          questionType: (q.questionType === 'true_false' ? 'true_false' : 'mcq') as 'true_false' | 'mcq',
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC?.trim() || null,
          optionD: q.optionD?.trim() || null,
          correctOption: q.correctOption.trim(),
          explanation: q.explanation?.trim() || null,
          updatedAt: nowStr,
        };

        if (q.id && existingQuestionIds.has(q.id)) {
          await db.update(question)
            .set(questionData)
            .where(eq(question.id, q.id));
        } else {
          await db.insert(question).values({
            id: nanoid(),
            quizId: id,
            ...questionData,
            createdAt: nowStr,
          });
        }
      }
    }
    
    return NextResponse.json({ quiz: updatedQuiz });
  } catch (error: any) {
    console.error('PUT /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const existingQuiz = await db.query.quiz.findFirst({ where: eq(quiz.id, id) });
    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to delete this quiz.' }, { status: 403 });
    }
    
    await db.delete(quiz).where(eq(quiz.id, id));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}