import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { question, quiz } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id, questionId } = await params;
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
    
    const existingQuestion = await db.query.question.findFirst({
      where: and(eq(question.id, questionId), eq(question.quizId, id)),
    });
    
    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    
    const body = await request.json();
    const { questionText, questionType, optionA, optionB, optionC, optionD, correctOption, explanation } = body;
    
    if (questionText !== undefined && !questionText.trim()) {
      return NextResponse.json({ error: 'Question text cannot be empty.' }, { status: 400 });
    }
    
    const newOptionA = optionA !== undefined ? optionA : existingQuestion.optionA;
    const newOptionB = optionB !== undefined ? optionB : existingQuestion.optionB;
    const newOptionC = optionC !== undefined ? optionC : existingQuestion.optionC;
    const newOptionD = optionD !== undefined ? optionD : existingQuestion.optionD;
    const newCorrectOption = correctOption !== undefined ? correctOption : existingQuestion.correctOption;
    
    const options = [newOptionA, newOptionB, newOptionC, newOptionD].filter(o => o && o.trim());
    if (options.length < 2) {
      return NextResponse.json({ error: 'At least 2 options are required.' }, { status: 400 });
    }
    
    if (!options.includes(newCorrectOption)) {
      return NextResponse.json({ error: 'Correct option must match one of the provided options.' }, { status: 400 });
    }
    
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (questionText !== undefined) updateData.questionText = questionText.trim();
    if (questionType !== undefined) updateData.questionType = questionType as 'mcq' | 'true_false';
    if (optionA !== undefined) updateData.optionA = optionA?.trim() || null;
    if (optionB !== undefined) updateData.optionB = optionB?.trim() || null;
    if (optionC !== undefined) updateData.optionC = optionC?.trim() || null;
    if (optionD !== undefined) updateData.optionD = optionD?.trim() || null;
    if (correctOption !== undefined) updateData.correctOption = correctOption.trim();
    if (explanation !== undefined) updateData.explanation = explanation?.trim() || null;
    
    const [updatedQuestion] = await db.update(question)
      .set(updateData)
      .where(and(eq(question.id, questionId), eq(question.quizId, id)))
      .returning();
    
    return NextResponse.json({ question: updatedQuestion });
  } catch (error: any) {
    console.error('PUT /api/quiz/[id]/questions/[questionId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const { id, questionId } = await params;
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
    }
    
    const existingQuiz = await db.query.quiz.findFirst({ where: eq(quiz.id, id) });
    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to delete from this quiz.' }, { status: 403 });
    }
    
    const existingQuestion = await db.query.question.findFirst({
      where: and(eq(question.id, questionId), eq(question.quizId, id)),
    });
    
    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }
    
    await db.delete(question).where(and(eq(question.id, questionId), eq(question.quizId, id)));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/quiz/[id]/questions/[questionId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}