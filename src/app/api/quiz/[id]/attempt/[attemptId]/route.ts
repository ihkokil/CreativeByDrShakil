import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
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
    const token = await extractCookieToken();

    const supabase = getSupabase(token);
    
    const { data: attemptRow } = await supabase
      .from('QuizAttempt')
      .select('*')
      .eq('id', attemptId)
      .eq('quizId', quizId)
      .eq('studentId', studentId)
      .limit(1)
      .maybeSingle();

    let attemptQuiz = null;
    if (attemptRow) {
      const { data: quizRow } = await supabase
        .from('Quiz')
        .select('*')
        .eq('id', (attemptRow as any).quizId)
        .limit(1)
        .maybeSingle();
      attemptQuiz = quizRow;
    }
    const attempt = attemptRow ? { ...(attemptRow as any), quiz: attemptQuiz! } : null;
    
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });
    }
    
    const { data: mappings = [] } = await supabase
      .from('QuizQuestionMapping')
      .select('*')
      .eq('attemptId', attemptId)
      .order('displayOrder', { ascending: true });

    const questionIds = (mappings || []).map((m: any) => m.questionId);
    
    const { data: mappingQuestions = [] } = questionIds.length > 0
      ? await supabase.from('Question').select('*').in('id', questionIds)
      : { data: [] };

    const questionMap = new Map((mappingQuestions || []).map((q: any) => [q.id, q]));
    const mappingsWithQuestions = (mappings || []).map((m: any) => ({ ...m, question: questionMap.get(m.questionId)! }));
    
    const { data: existingAnswers = [] } = await supabase
      .from('AttemptAnswer')
      .select('*')
      .eq('attemptId', attemptId);
    
    const mappedQuestions = mappingsWithQuestions.map((m) => {
      const q = m.question;
      const originalOptions = [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== '');
      
      let orderedOptions = originalOptions;
      if (Array.isArray(m.optionOrder)) {
        orderedOptions = m.optionOrder.map((key: any) => {
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
      existingAnswers: (existingAnswers || []).map((a: any) => ({
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
