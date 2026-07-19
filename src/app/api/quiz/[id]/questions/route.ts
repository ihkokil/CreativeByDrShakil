import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { requireTeacherPayload } from '@/lib/route-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      return NextResponse.json({ error: 'Not authorized to view this quiz.' }, { status: 403 });
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
      return NextResponse.json({ error: 'Not authorized to add questions to this quiz.' }, { status: 403 });
    }
    
    const body = await request.json();
    const { questionText, questionType, optionA, optionB, optionC, optionD, correctOption, explanation } = body;
    
    if (!questionText || !questionText.trim()) {
      return NextResponse.json({ error: 'Question text is required.' }, { status: 400 });
    }
    
    if (!optionA || !optionA.trim()) {
      return NextResponse.json({ error: 'Option A is required.' }, { status: 400 });
    }
    
    if (!optionB || !optionB.trim()) {
      return NextResponse.json({ error: 'Option B is required.' }, { status: 400 });
    }
    
    if (!correctOption || !correctOption.trim()) {
      return NextResponse.json({ error: 'Correct option is required.' }, { status: 400 });
    }
    
    const options = [optionA, optionB, optionC, optionD].filter(o => o && o.trim());
    if (options.length < 2) {
      return NextResponse.json({ error: 'At least 2 options are required.' }, { status: 400 });
    }
    
    if (!options.includes(correctOption)) {
      return NextResponse.json({ error: 'Correct option must match one of the provided options.' }, { status: 400 });
    }
    
    const questionTypeTyped: 'mcq' | 'true_false' = questionType === 'true_false' ? 'true_false' : 'mcq';
    const nowStr = new Date().toISOString();
    
    const questionId = crypto.randomUUID();
    const insertValues = {
      id: questionId,
      quizId: id,
      questionText: questionText.trim(),
      questionType: questionTypeTyped,
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC?.trim() || null,
      optionD: optionD?.trim() || null,
      correctOption: correctOption.trim(),
      explanation: explanation?.trim() || null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    const { error: insertError } = await supabase.from('Question')
// @ts-ignore
.insert(insertValues as any);
    if (insertError) throw insertError;
    
    return NextResponse.json({ question: insertValues }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/questions error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}