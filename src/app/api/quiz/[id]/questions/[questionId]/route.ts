import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { recalculateQuizResults, normalizeQuestionType } from '@/lib/quiz-engine';

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

    const supabase = getSupabaseAdmin();

    const { data: existingQuiz } = await supabase
      .from('Quiz')
      .select('id, createdBy')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (payload.role === 'teacher' && existingQuiz.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to edit this quiz.' }, { status: 403 });
    }

    const { data: existingQuestion } = await supabase
      .from('Question')
      .select('*')
      .eq('id', questionId)
      .eq('quizId', id)
      .limit(1)
      .maybeSingle();

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const body = await request.json();
    const { questionText, questionType, optionA, optionB, optionC, optionD, optionE, correctOption, explanation } = body;

    if (questionText !== undefined && !questionText.trim()) {
      return NextResponse.json({ error: 'Question text cannot be empty.' }, { status: 400 });
    }

    const newOptionA = optionA !== undefined ? optionA : (existingQuestion as any).optionA;
    const newOptionB = optionB !== undefined ? optionB : (existingQuestion as any).optionB;
    const newOptionC = optionC !== undefined ? optionC : (existingQuestion as any).optionC;
    const newOptionD = optionD !== undefined ? optionD : (existingQuestion as any).optionD;
    const newOptionE = optionE !== undefined ? optionE : (existingQuestion as any).optionE;
    let newCorrectOption = (correctOption !== undefined ? correctOption : (existingQuestion as any).correctOption || '').trim().toUpperCase();

    const rawType = questionType !== undefined ? questionType : (existingQuestion as any).questionType;
    const normalizedType = normalizeQuestionType(rawType);

    if (normalizedType === 'true_false') {
      if (newCorrectOption.length !== 5 || !/^[TF]{5}$/i.test(newCorrectOption)) {
        newCorrectOption = newCorrectOption.padEnd(5, 'F').slice(0, 5);
      }
    } else {
      // SBA
      if (!/^[A-E]$/i.test(newCorrectOption)) {
        return NextResponse.json({ error: 'For SBA questions, correct answer must be one letter (A, B, C, D, or E).' }, { status: 400 });
      }
    }

    const updateData: any = {
      questionText: questionText !== undefined ? questionText.trim() : (existingQuestion as any).questionText,
      questionType: normalizedType,
      optionA: newOptionA ? String(newOptionA).trim() : '',
      optionB: newOptionB ? String(newOptionB).trim() : '',
      optionC: newOptionC ? String(newOptionC).trim() : null,
      optionD: newOptionD ? String(newOptionD).trim() : null,
      optionE: newOptionE ? String(newOptionE).trim() : null,
      correctOption: newCorrectOption,
      explanation: explanation !== undefined ? (explanation ? String(explanation).trim() : null) : (existingQuestion as any).explanation,
      updatedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('Question')
      .update(updateData as any)
      .eq('id', questionId)
      .eq('quizId', id);

    if (updateError) throw updateError;

    // Automatic cascade re-grading for all student attempts of this quiz
    try {
      await recalculateQuizResults(id, supabase);
    } catch (recalcErr) {
      console.warn('Recalculate error after question update:', recalcErr);
    }

    const { data: updatedQuestion } = await supabase
      .from('Question')
      .select('*')
      .eq('id', questionId)
      .eq('quizId', id)
      .limit(1)
      .maybeSingle();

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

    const supabase = getSupabaseAdmin();

    const { data: existingQuiz } = await supabase
      .from('Quiz')
      .select('id, createdBy')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (payload.role === 'teacher' && (existingQuiz as any).createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to delete from this quiz.' }, { status: 403 });
    }

    const { data: existingQuestion } = await supabase
      .from('Question')
      .select('id')
      .eq('id', questionId)
      .eq('quizId', id)
      .limit(1)
      .maybeSingle();

    if (!existingQuestion) {
      return NextResponse.json({ error: 'Question not found.' }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from('Question')
      .delete()
      .eq('id', questionId)
      .eq('quizId', id);

    if (deleteError) throw deleteError;

    // Automatic cascade re-grading for all student attempts
    try {
      await recalculateQuizResults(id, supabase);
    } catch (recalcErr) {
      console.warn('Recalculate error after question delete:', recalcErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/quiz/[id]/questions/[questionId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}