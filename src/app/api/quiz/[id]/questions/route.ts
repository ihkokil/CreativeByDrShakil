import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { recalculateQuizResults, normalizeQuestionType } from '@/lib/quiz-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Not authorized to view this quiz.' }, { status: 403 });
    }

    if (payload.role === 'student') {
      const { data: attempt } = await supabase
        .from('QuizAttempt')
        .select('id')
        .eq('quizId', id)
        .eq('studentId', payload.sub)
        .in('status', ['submitted', 'auto_submitted'])
        .limit(1)
        .maybeSingle();

      if (!attempt) {
        return NextResponse.json({ error: 'You must complete at least one attempt before downloading questions and answers.' }, { status: 403 });
      }
    }

    const { data: questions = [] } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', id)
      .order('createdAt', { ascending: true });

    const questionsWithOptions = (questions || []).map((q: any) => ({
      ...q,
      options: [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
        { letter: 'E', text: q.optionE },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== ''),
    }));

    return NextResponse.json({ questions: questionsWithOptions });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/questions error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

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
      return NextResponse.json({ error: 'Not authorized to add questions to this quiz.' }, { status: 403 });
    }

    const body = await request.json();
    const { questionText, questionType, optionA, optionB, optionC, optionD, optionE, correctOption, explanation } = body;

    if (!questionText || !questionText.trim()) {
      return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });
    }

    if (!optionA || !optionA.trim()) {
      return NextResponse.json({ error: 'Option A is required.' }, { status: 400 });
    }

    if (!optionB || !optionB.trim()) {
      return NextResponse.json({ error: 'Option B is required.' }, { status: 400 });
    }

    if (!correctOption || !String(correctOption).trim()) {
      return NextResponse.json({ error: 'Correct option is required.' }, { status: 400 });
    }

    const normalizedType = normalizeQuestionType(questionType);
    let finalCorrectOption = String(correctOption).trim().toUpperCase();

    if (normalizedType === 'true_false') {
      if (finalCorrectOption.length !== 5 || !/^[TF]{5}$/i.test(finalCorrectOption)) {
        finalCorrectOption = finalCorrectOption.padEnd(5, 'F').slice(0, 5);
      }
    } else {
      // SBA
      if (!/^[A-E]$/i.test(finalCorrectOption)) {
        return NextResponse.json({ error: 'For SBA questions, correct answer must be one letter (A, B, C, D, or E).' }, { status: 400 });
      }
    }

    const nowStr = new Date().toISOString();
    const questionId = nanoid();
    const insertValues = {
      id: questionId,
      quizId: id,
      questionText: questionText.trim(),
      questionType: normalizedType,
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC?.trim() || null,
      optionD: optionD?.trim() || null,
      optionE: optionE?.trim() || null,
      correctOption: finalCorrectOption,
      explanation: explanation?.trim() || null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const { error: insertError } = await supabase
      .from('Question')
      // @ts-ignore
      .insert(insertValues as any);
    if (insertError) throw insertError;

    // Recalculate past attempts
    try {
      await recalculateQuizResults(id, supabase);
    } catch (recalcErr) {
      console.warn('Recalculate error after question add:', recalcErr);
    }

    return NextResponse.json({ question: insertValues }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/questions error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}