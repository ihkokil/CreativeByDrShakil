import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { attemptAnswer, quizAttempt, question, quizQuestionMapping } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';

interface AnswerInput {
  questionId: string;
  selectedOption: string | null;
}

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
    });
    
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    
    if (attempt.status !== 'in_progress') {
      return NextResponse.json({ error: 'Quiz attempt is no longer active.' }, { status: 400 });
    }
    
    const body = await request.json();
    
    // Support both batch format { answers: [...] } and single format { questionId, selectedOption }
    let answersToSave: AnswerInput[] = [];
    
    if (Array.isArray(body.answers) && body.answers.length > 0) {
      // Batch format from the client
      answersToSave = body.answers.filter((a: any) => a.questionId);
    } else if (body.questionId) {
      // Single answer format (backward compatibility)
      answersToSave = [{ questionId: body.questionId, selectedOption: body.selectedOption }];
    }
    
    if (answersToSave.length === 0) {
      return NextResponse.json({ error: 'No valid answers provided.' }, { status: 400 });
    }
    
    // Fetch all question IDs for this attempt in one query
    const questionIds = answersToSave.map(a => a.questionId);
    const mappings = await db.query.quizQuestionMapping.findMany({
      where: and(
        eq(quizQuestionMapping.attemptId, attemptId),
        inArray(quizQuestionMapping.questionId, questionIds)
      ),
    });
    
    const validQuestionIds = new Set(mappings.map(m => m.questionId));
    
    // Fetch question data for correct option checking
    const questions = await db.query.question.findMany({
      where: inArray(question.id, questionIds),
    });
    const questionMap = new Map(questions.map(q => [q.id, q]));
    
    // Fetch existing answers for these questions
    const existingAnswers = await db.query.attemptAnswer.findMany({
      where: and(
        eq(attemptAnswer.attemptId, attemptId),
        inArray(attemptAnswer.questionId, questionIds)
      ),
    });
    const existingMap = new Map(existingAnswers.map(a => [a.questionId, a]));
    
    const results: { questionId: string; saved: boolean; isLocked: boolean; isCorrect: boolean }[] = [];
    
    for (const ans of answersToSave) {
      // Skip if question is not part of this attempt
      if (!validQuestionIds.has(ans.questionId)) {
        results.push({ questionId: ans.questionId, saved: false, isLocked: false, isCorrect: false });
        continue;
      }
      
      const questionData = questionMap.get(ans.questionId);
      if (!questionData) {
        results.push({ questionId: ans.questionId, saved: false, isLocked: false, isCorrect: false });
        continue;
      }
      
      const existing = existingMap.get(ans.questionId);
      
      // If already answered and locked, skip
      if (existing && existing.selectedOption) {
        results.push({ 
          questionId: ans.questionId, 
          saved: true, 
          isLocked: true, 
          isCorrect: existing.isCorrect 
        });
        continue;
      }
      
      const isCorrect = !!(ans.selectedOption && ans.selectedOption === questionData.correctOption);
      
      if (existing) {
        // Update existing row
        await db.update(attemptAnswer).set({
          selectedOption: ans.selectedOption || null,
          isCorrect,
        }).where(eq(attemptAnswer.id, existing.id));
      } else {
        // Insert new row
        await db.insert(attemptAnswer).values({
          id: crypto.randomUUID(),
          attemptId,
          questionId: ans.questionId,
          selectedOption: ans.selectedOption || null,
          isCorrect,
        });
      }
      
      results.push({ 
        questionId: ans.questionId, 
        saved: true, 
        isLocked: !!ans.selectedOption, 
        isCorrect 
      });
    }
    
    return NextResponse.json({ 
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('POST /api/quiz/attempt/[attemptId]/save-answer error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}