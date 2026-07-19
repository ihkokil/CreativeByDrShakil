import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { shuffleArray } from '@/lib/shuffle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;
    const payload = await getAuthPayload(request);
    
    if (!payload || payload.role !== 'student') {
      return NextResponse.json({ error: 'Unauthorized. Student access required.' }, { status: 401 });
    }
    
    const studentId = payload.sub;
    const token = await extractCookieToken();

    const supabase = getSupabase(token);
    
    const { data: rawQuiz } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    let quizQuestions: any[] = [];
    if (rawQuiz) {
      const { data: questions } = await supabase
        .from('Question')
        .select('*')
        .eq('quizId', quizId);
      quizQuestions = questions || [];
    }
    const quizData = rawQuiz ? { ...(rawQuiz as any), questions: quizQuestions } : null;
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (quizData.status !== 'published') {
      return NextResponse.json({ error: 'Quiz is not available.' }, { status: 403 });
    }
    
    const now = new Date();
    if (quizData.startDatetime && new Date(quizData.startDatetime) > now) {
      return NextResponse.json({ error: 'Quiz has not started yet.' }, { status: 403 });
    }
    if (quizData.endDatetime && new Date(quizData.endDatetime) < now) {
      return NextResponse.json({ error: 'Quiz has ended.' }, { status: 403 });
    }
    
    const { data: existingAttempt } = await supabase
      .from('QuizAttempt')
      .select('*')
      .eq('quizId', quizId)
      .eq('studentId', studentId)
      .eq('status', 'in_progress')
      .order('startedAt', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (existingAttempt) {
      const { data: mappings = [] } = await supabase
        .from('QuizQuestionMapping')
        .select('*')
        .eq('attemptId', (existingAttempt as any).id);

      const questionIds = (mappings || []).map((m: any) => m.questionId);

      const { data: mappingQuestions = [] } = questionIds.length > 0 
        ? await supabase.from('Question').select('*').in('id', questionIds) 
        : { data: [] };

      const questionMap = new Map((mappingQuestions || []).map((q: any) => [q.id, q]));
      const mappingsWithQuestions = (mappings || []).map((m: any) => ({ ...m, question: questionMap.get(m.questionId)! }));
      
      const { data: answers = [] } = await supabase
        .from('AttemptAnswer')
        .select('*')
        .eq('attemptId', (existingAttempt as any).id);
      
      const answerMap = new Map((answers || []).map((a: any) => [a.questionId, a.selectedOption]));
      
      return NextResponse.json({
        attempt: existingAttempt,
        questions: mappingsWithQuestions.map(m => ({
          ...m.question,
          displayOrder: m.displayOrder,
          optionOrder: m.optionOrder,
          selectedOption: answerMap.get(m.questionId) || null,
        })),
        remainingTimeSeconds: Math.max(0, quizData.durationMinutes * 60 - Math.floor((Date.now() - new Date((existingAttempt as any).startedAt).getTime()) / 1000)),
      });
    }
    
    const { count: attemptCount = 0 } = await supabase
      .from('QuizAttempt')
      .select('*', { count: 'exact', head: true })
      .eq('quizId', quizId)
      .eq('studentId', studentId);
    
    if (!quizData.allowMultipleAttempts && (attemptCount || 0) > 0) {
      return NextResponse.json({ error: 'You have already attempted this quiz.' }, { status: 403 });
    }
    
    if (quizData.maxAttempts && (attemptCount || 0) >= quizData.maxAttempts) {
      return NextResponse.json({ error: `Maximum attempts (${quizData.maxAttempts}) reached.` }, { status: 403 });
    }
    
    const availableQuestions = quizData.questions;
    if (availableQuestions.length < quizData.numQuestionsToServe) {
      return NextResponse.json({ error: 'Not enough questions in the quiz bank.' }, { status: 500 });
    }
    
    const shuffledQuestions = shuffleArray([...availableQuestions]);
    const selectedQuestions = shuffledQuestions.slice(0, quizData.numQuestionsToServe);
    
    const attemptId = nanoid();
    const startedAt = new Date().toISOString();
    
    const insertValues = {
      id: attemptId,
      quizId,
      studentId,
      startedAt,
      status: 'in_progress',
      attemptNumber: (attemptCount || 0) + 1,
      createdAt: startedAt,
      updatedAt: startedAt,
    };

    // @ts-ignore
    const { error: insertAttemptError } = await supabase.from('QuizAttempt')
// @ts-ignore
.insert(insertValues);
    if (insertAttemptError) throw insertAttemptError;

    const newAttempt = {
      ...insertValues,
      submittedAt: null,
      timeTakenSeconds: null,
      isAutoSubmitted: false,
      totalScore: 0,
      correctCount: 0,
      wrongCount: 0,
      skippedCount: 0,
      negativeMarks: 0,
      netScore: 0,
      percentageScore: 0,
      rank: null,
    };
    
    const mappings = selectedQuestions.map((q, index) => {
      const options = [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);
      const optionOrder = quizData.shuffleOptions ? shuffleArray(options.map((_, i) => i)) : options.map((_, i) => i);
      
      return {
        id: nanoid(),
        attemptId,
        questionId: q.id,
        displayOrder: index + 1,
        optionOrder,
      };
    });
    
    // @ts-ignore
    const { error: insertMappingsError } = await supabase.from('QuizQuestionMapping')
// @ts-ignore
.insert(mappings);
    if (insertMappingsError) throw insertMappingsError;
    
    return NextResponse.json({
      attempt: newAttempt,
      questions: mappings.map(m => ({
        ...selectedQuestions.find(q => q.id === m.questionId)!,
        displayOrder: m.displayOrder,
        optionOrder: m.optionOrder,
        selectedOption: null,
      })),
      remainingTimeSeconds: quizData.durationMinutes * 60,
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz/[id]/attempt error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}