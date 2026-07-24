import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
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
    
    const token = await extractCookieToken();

    
    const supabase = getSupabase(token);

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
    const newCorrectOption = correctOption !== undefined ? correctOption : (existingQuestion as any).correctOption;
    
    const options = [newOptionA, newOptionB, newOptionC, newOptionD, newOptionE].filter(o => o && (typeof o === 'string' ? o.trim() : true));
    if (options.length < 2) {
      return NextResponse.json({ error: 'At least 2 options are required.' }, { status: 400 });
    }
    
    const newQuestionType = questionType !== undefined ? questionType : (existingQuestion as any).questionType;
    if (newQuestionType === 'sba' || newQuestionType === 'true_false') {
      if (!options.includes(newCorrectOption)) {
        return NextResponse.json({ error: 'Correct option must match one of the provided options.' }, { status: 400 });
      }
    } else if (newQuestionType === 'mcq') {
      if (!/^[TF]+$/i.test(newCorrectOption)) {
        return NextResponse.json({ error: 'For MCQ, correct option must be a string of T and F.' }, { status: 400 });
      }
    }
    
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (questionText !== undefined) updateData.questionText = questionText.trim();
    if (questionType !== undefined) updateData.questionType = questionType as 'mcq' | 'true_false' | 'sba';
    if (optionA !== undefined) updateData.optionA = optionA?.trim() || null;
    if (optionB !== undefined) updateData.optionB = optionB?.trim() || null;
    if (optionC !== undefined) updateData.optionC = optionC?.trim() || null;
    if (optionD !== undefined) updateData.optionD = optionD?.trim() || null;
    if (optionE !== undefined) updateData.optionE = optionE?.trim() || null;
    if (correctOption !== undefined) updateData.correctOption = correctOption.trim();
    if (explanation !== undefined) updateData.explanation = explanation?.trim() || null;
    
    const { error: updateError } = await supabase
      .from('Question')
      .update(updateData as any)
      .eq('id', questionId)
      .eq('quizId', id);

    if (updateError) throw updateError;

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
    
    const token = await extractCookieToken();

    
    const supabase = getSupabase(token);

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
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/quiz/[id]/questions/[questionId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}