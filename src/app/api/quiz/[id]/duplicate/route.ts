import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: quizId } = await params;
    const supabase = getSupabase();

    const { data: original, error: fetchError }: { data: any; error: any } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!original) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (payload.role === 'teacher' && original.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to duplicate this quiz.' }, { status: 403 });
    }

    const newId = nanoid();
    const nowStr = new Date().toISOString();

    const { error: insertError } = await supabase.from('Quiz').insert({
      id: newId,
      title: `${original.title} (Copy)`,
      description: original.description,
      instructions: original.instructions,
      categoryId: original.categoryId,
      durationMinutes: original.durationMinutes,
      numQuestionsToServe: original.numQuestionsToServe,
      positionType: original.positionType,
      allowMultipleAttempts: original.allowMultipleAttempts,
      maxAttempts: original.maxAttempts,
      allowNegativeMarking: original.allowNegativeMarking,
      negativeValue: original.negativeValue,
      marksPerCorrect: original.marksPerCorrect,
      shuffleQuestions: original.shuffleQuestions,
      shuffleOptions: original.shuffleOptions,
      status: 'draft',
      createdBy: payload.sub,
      createdAt: nowStr,
      updatedAt: nowStr,
    } as any);

    if (insertError) throw insertError;

    // Duplicate questions
    const { data: questions = [] } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', quizId)
      .order('createdAt', { ascending: true });

    for (const q of (questions || []) as any[]) {
      await supabase.from('Question').insert({
        id: nanoid(),
        quizId: newId,
        questionText: q.questionText,
        questionType: q.questionType,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        explanation: q.explanation,
        createdAt: nowStr,
        updatedAt: nowStr,
      } as any);
    }

    return NextResponse.json({
      success: true,
      quizId: newId,
      message: `Quiz duplicated with ${(questions || []).length} questions.`,
    });
  } catch (error: any) {
    console.error('[quiz/duplicate] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
