import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { shuffleArray } from '@/lib/shuffle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: quizId } = await params;
    const supabase = getSupabase();

    // Fetch quiz
    const { data: quiz, error: quizError }: { data: any; error: any } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', quizId)
      .limit(1)
      .maybeSingle();

    if (quizError) throw quizError;
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }

    if (quiz.status !== 'published') {
      return NextResponse.json({ error: 'Quiz is not available.' }, { status: 400 });
    }

    // Time window check
    const now = new Date();
    if (quiz.startDatetime && new Date(quiz.startDatetime) > now) {
      return NextResponse.json({ error: 'Quiz has not started yet.' }, { status: 403 });
    }
    if (quiz.endDatetime && new Date(quiz.endDatetime) < now) {
      return NextResponse.json({ error: 'Quiz has ended.' }, { status: 403 });
    }

    // Check existing attempts
    const { data: existingAttempts = [] } = await supabase
      .from('QuizAttempt')
      .select('id, status')
      .eq('quizId', quizId)
      .eq('studentId', payload.sub);

    // Check for in-progress attempt
    const inProgress = (existingAttempts || []).find((a: any) => a.status === 'in_progress');
    if (inProgress) {
      return NextResponse.json({
        attemptId: inProgress.id,
        status: 'in_progress',
        message: 'You already have an in-progress attempt.',
      });
    }

    // Check max attempts
    const completedAttempts = (existingAttempts || []).filter((a: any) => a.status === 'submitted' || a.status === 'auto_submitted');
    if (!quiz.allowMultipleAttempts && completedAttempts.length > 0) {
      return NextResponse.json({ error: 'You have already completed this quiz.' }, { status: 403 });
    }
    if (quiz.maxAttempts && completedAttempts.length >= quiz.maxAttempts) {
      return NextResponse.json({ error: 'Maximum attempts reached.' }, { status: 403 });
    }

    // Fetch questions
    const { data: questions = [] } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', quizId)
      .order('createdAt', { ascending: true });

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'Quiz has no questions.' }, { status: 400 });
    }

    // Optionally shuffle and limit questions
    let selectedQuestions = [...(questions || [])];
    if (quiz.shuffleQuestions) {
      selectedQuestions = shuffleArray(selectedQuestions);
    }
    if (quiz.numQuestionsToServe && quiz.numQuestionsToServe < selectedQuestions.length) {
      selectedQuestions = selectedQuestions.slice(0, quiz.numQuestionsToServe);
    }

    // Create the attempt
    const nowStr = now.toISOString();
    const attemptId = nanoid();

    const { error: attemptError } = await supabase.from('QuizAttempt').insert({
      id: attemptId,
      quizId,
      studentId: payload.sub,
      status: 'in_progress',
      startedAt: nowStr,
      totalQuestions: selectedQuestions.length,
      createdAt: nowStr,
    } as any);

    if (attemptError) throw attemptError;

    // Create question mappings with optional option shuffling
    const optionLetters = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < selectedQuestions.length; i++) {
      const q = selectedQuestions[i] as any;
      const optionOrder = quiz.shuffleOptions ? shuffleArray([...optionLetters]) : [...optionLetters];

      await supabase.from('QuizQuestionMapping').insert({
        id: nanoid(),
        attemptId,
        questionId: q.id,
        displayOrder: i + 1,
        optionOrder: JSON.stringify(optionOrder),
      } as any);
    }

    return NextResponse.json({
      attemptId,
      status: 'in_progress',
      totalQuestions: selectedQuestions.length,
      durationMinutes: quiz.durationMinutes,
      startedAt: nowStr,
    });
  } catch (error: any) {
    console.error('[quiz/start] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
