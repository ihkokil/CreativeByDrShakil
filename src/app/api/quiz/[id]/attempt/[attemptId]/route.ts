import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { normalizeQuestionType } from '@/lib/quiz-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> }
) {
  try {
    const { id: quizId, attemptId } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    const supabase = getSupabaseAdmin();
    
    const { data: attemptRow } = await supabase
      .from('QuizAttempt')
      .select('*')
      .eq('id', attemptId)
      .eq('quizId', quizId)
      .eq('studentId', studentId)
      .limit(1)
      .maybeSingle();

    if (!attemptRow) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }

    const { data: quizRow } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    const attempt = { ...(attemptRow as any), quiz: quizRow || {} };
    
    const { data: mappings = [] } = await supabase
      .from('QuizQuestionMapping')
      .select('*')
      .eq('attemptId', attemptId)
      .order('displayOrder', { ascending: true });

    let questionIds = (mappings || []).map((m: any) => m.questionId);
    let mappingQuestions: any[] = [];

    if (questionIds.length > 0) {
      const { data: qData = [] } = await supabase
        .from('Question')
        .select('*')
        .in('id', questionIds);
      mappingQuestions = qData || [];
    }

    // Fallback if no mappings exist
    if (mappingQuestions.length === 0) {
      const { data: fallbackQuestions = [] } = await supabase
        .from('Question')
        .select('*')
        .eq('quizId', quizId)
        .order('createdAt', { ascending: true });
      mappingQuestions = fallbackQuestions || [];
    }

    const questionMap = new Map((mappingQuestions || []).map((q: any) => [q.id, q]));
    const mappingsWithQuestions = (mappings && mappings.length > 0)
      ? mappings.map((m: any) => ({ ...m, question: questionMap.get(m.questionId) })).filter((m: any) => m.question)
      : mappingQuestions.map((q: any, idx: number) => ({ displayOrder: idx + 1, question: q, optionOrder: null }));
    
    const { data: existingAnswers = [] } = await supabase
      .from('AttemptAnswer')
      .select('*')
      .eq('attemptId', attemptId);

    const isInProgress = attempt.status === 'in_progress';
    
    const mappedQuestions = mappingsWithQuestions.map((m: any) => {
      const q = m.question;
      const normalizedType = normalizeQuestionType(q.questionType);
      const originalOptions = [
        { letter: 'A', text: q.optionA || '' },
        { letter: 'B', text: q.optionB || '' },
        { letter: 'C', text: q.optionC || '' },
        { letter: 'D', text: q.optionD || '' },
        { letter: 'E', text: q.optionE || '' },
      ];
      
      let orderedOptions = originalOptions;
      if (normalizedType === 'sba' && m.optionOrder) {
        let orderKeys = m.optionOrder;
        if (typeof orderKeys === 'string') {
          try { orderKeys = JSON.parse(orderKeys); } catch {}
        }
        if (Array.isArray(orderKeys)) {
          orderedOptions = orderKeys.map((key: any) => {
            if (typeof key === 'number') {
              const letters = ['A', 'B', 'C', 'D', 'E'];
              return originalOptions.find(o => o.letter === letters[key]);
            } else if (typeof key === 'string') {
              return originalOptions.find(o => o.letter === key);
            }
            return null;
          }).filter(Boolean) as any[];

          const orderedLetters = new Set(orderedOptions.map(o => o.letter));
          originalOptions.forEach(o => {
            if (!orderedLetters.has(o.letter)) {
              orderedOptions.push(o);
            }
          });
        }
      }
      
      return {
        id: q.id,
        questionText: q.questionText,
        questionType: normalizedType,
        options: orderedOptions,
        displayOrder: m.displayOrder,
        correctOption: isInProgress ? undefined : q.correctOption,
        explanation: isInProgress ? undefined : q.explanation,
      };
    });
    
    const nowServer = new Date();
    const startedAtStr = attempt.startedAt || new Date().toISOString();
    const startedAt = new Date(
      startedAtStr.endsWith('Z') || startedAtStr.includes('+') 
        ? startedAtStr 
        : startedAtStr + 'Z'
    );
    const elapsedSeconds = Math.max(0, Math.floor((nowServer.getTime() - startedAt.getTime()) / 1000));
    const durationMins = Number(attempt.quiz?.durationMinutes || 0);
    const timeRemaining = durationMins === 0 
      ? null 
      : Math.max(0, (durationMins * 60) - elapsedSeconds);

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        quizId: attempt.quizId,
        studentId: attempt.studentId,
        startedAt: attempt.startedAt,
        durationMinutes: durationMins,
        status: attempt.status,
        timeRemaining,
      },
      questions: mappedQuestions,
      existingAnswers: (existingAnswers || []).map((a: any) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        isCorrect: isInProgress ? undefined : a.isCorrect,
      })),
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/attempt/[attemptId] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
