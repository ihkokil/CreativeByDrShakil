import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { recalculateQuizResults, computeMaxMarksForQuestions, getScoringRules, calculateDynamicLeaderboard } from '@/lib/quiz-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    const isTeacher = payload && (payload.role === 'teacher' || payload.role === 'admin');
    
    const supabase = getSupabaseAdmin();

    const { data: quizRow } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    let quizCategoryData = null;
    let quizCreatorData = null;
    let quizQuestionsData: any[] = [];

    if (quizRow) {
      if ((quizRow as any).categoryId) {
        const { data: category } = await supabase
          .from('QuizCategory')
          .select('*')
          .eq('id', (quizRow as any).categoryId)
          .limit(1)
          .maybeSingle();
        quizCategoryData = category;
      }
      
      const { data: creator } = await supabase
        .from('User')
        .select('id, fullName')
        .eq('id', (quizRow as any).createdBy)
        .limit(1)
        .maybeSingle();
      quizCreatorData = creator;

      const { data: questions } = await supabase
        .from('Question')
        .select('*')
        .eq('quizId', id)
        .order('createdAt', { ascending: true });
      quizQuestionsData = questions || [];
    }
    
    const quizData = quizRow ? { ...(quizRow as any), category: quizCategoryData || null, creator: quizCreatorData || null, questions: quizQuestionsData } : null;
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (!isTeacher) {
      if (quizData.status !== 'published') {
        return NextResponse.json({ error: 'Quiz not available.' }, { status: 404 });
      }

      if (!payload) {
        return NextResponse.json({ error: 'Please log in to access this quiz.' }, { status: 401 });
      }

      // Check course enrollment
      const { data: courseQuiz } = await supabase
        .from('CourseQuiz')
        .select('id, courseId, curriculumNodeId')
        .eq('quizId', id)
        .maybeSingle();

      if (!courseQuiz) {
        return NextResponse.json({ error: 'Quiz is not linked to any course.' }, { status: 403 });
      }

      const { data: order } = await supabase
        .from('Order')
        .select('id, enrolledAt, batchId, updatedAt')
        .eq('userId', payload.sub)
        .eq('courseId', courseQuiz.courseId)
        .eq('status', 'approved')
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: 'You must be enrolled in the course to access this quiz.' }, { status: 403 });
      }
      
      const now = new Date();
      if (quizData.startDatetime && new Date(quizData.startDatetime) > now) {
        return NextResponse.json({ error: 'Quiz has not started yet.' }, { status: 403 });
      }
      if (quizData.endDatetime && new Date(quizData.endDatetime) < now) {
        return NextResponse.json({ error: 'Quiz has ended.' }, { status: 403 });
      }
    } else if (payload?.role === 'teacher' && quizData.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to view this quiz.' }, { status: 403 });
    }
    
    let allAttemptsData: any[] = [];
    let attempt = null;
    if (payload && payload.sub) {
      const { data: attemptRow } = await supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id)
        .eq('studentId', payload.sub)
        .order('startedAt', { ascending: false })
        .limit(1)
        .maybeSingle();

      let attemptAnswersData: any[] = [];
      let attemptMappingsData: any[] = [];

      if (attemptRow) {
        const { data: answers } = await supabase
          .from('AttemptAnswer')
          .select('*')
          .eq('attemptId', (attemptRow as any).id);
        attemptAnswersData = answers || [];

        const { data: mappings } = await supabase
          .from('QuizQuestionMapping')
          .select('*')
          .eq('attemptId', (attemptRow as any).id);
        attemptMappingsData = mappings || [];
      }
      attempt = attemptRow ? { ...(attemptRow as any), answers: attemptAnswersData, questionMappings: attemptMappingsData } : null;
      
      const { data: attemptsRows } = await supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id)
        .eq('studentId', payload.sub)
        .order('startedAt', { ascending: false });
      allAttemptsData = attemptsRows || [];
    }
    
    const questionsWithOptions = quizData.questions.map((q: any) => ({
      ...q,
      options: [
        { letter: 'A', text: q.optionA },
        { letter: 'B', text: q.optionB },
        { letter: 'C', text: q.optionC },
        { letter: 'D', text: q.optionD },
        { letter: 'E', text: q.optionE },
      ].filter(o => o.text !== null && o.text !== undefined && o.text !== ''),
    }));
    
    const totalMarks = computeMaxMarksForQuestions(quizData.questions, quizData);

    // Calculate dynamic leaderboard across all completed attempts
    const { data: rawSubmittedAttempts = [] } = await supabase
      .from('QuizAttempt')
      .select('id, quizId, studentId, netScore, percentageScore, correctCount, wrongCount, skippedCount, attemptNumber, timeTakenSeconds, submittedAt, status')
      .eq('quizId', id);

    const isCompletedStatus = (st: string) => {
      const s = (st || '').toLowerCase().trim();
      return s === 'submitted' || s === 'auto_submitted' || s === 'completed';
    };

    const completedRawAttempts = (rawSubmittedAttempts || []).filter((a: any) => isCompletedStatus(a.status) || (a.netScore !== null && a.netScore !== undefined));
    const studentIds = [...new Set(completedRawAttempts.map((a: any) => a.studentId))];
    const { data: rawUsers = [] } = studentIds.length > 0
      ? await supabase.from('User').select('id, fullName, email').in('id', studentIds)
      : { data: [] };
    const userMap = new Map((rawUsers || []).map((u: any) => [u.id, u]));

    const attemptsWithUsers = completedRawAttempts.map((a: any) => ({
      ...a,
      student: userMap.get(a.studentId) || null,
      studentName: userMap.get(a.studentId)?.fullName || 'Student',
    }));

    const { leaderboard, userRank, totalParticipants } = calculateDynamicLeaderboard(
      quizData,
      attemptsWithUsers,
      payload?.sub || null
    );
    
    return NextResponse.json({
      quiz: {
        ...quizData,
        totalMarks,
        questions: questionsWithOptions,
      },
      allAttempts: allAttemptsData,
      leaderboard,
      userRank,
      totalParticipants,
      attempt: attempt ? {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        answers: attempt.answers.map((a: any) => ({ questionId: a.questionId, selectedOption: a.selectedOption })),
        questionMappings: attempt.questionMappings.map((m: any) => ({
          questionId: m.questionId,
          displayOrder: m.displayOrder,
          optionOrder: m.optionOrder,
        })),
      } : null,
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function PUT(
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
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (!existingQuiz) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    if (payload.role === 'teacher' && (existingQuiz as any).createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to edit this quiz.' }, { status: 403 });
    }
    
    const body = await request.json();
    const {
      title,
      description,
      instructions,
      categoryId,
      durationMinutes,
      numQuestionsToServe,
      positionType,
      allowMultipleAttempts,
      maxAttempts,
      allowNegativeMarking,
      negativeValue,
      marksPerCorrect,
      sbaMarks,
      sbaNegative,
      tfMarks,
      tfNegative,
      startDatetime,
      endDatetime,
      shuffleQuestions,
      shuffleOptions,
      status,
      questions,
    } = body;
    
    if (title !== undefined && !title) {
      return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
    }
    
    if (categoryId !== undefined && categoryId) {
      const { data: category } = await supabase
        .from('QuizCategory')
        .select('id')
        .eq('id', categoryId)
        .limit(1)
        .maybeSingle();
      if (!category) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
    }
    
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (instructions !== undefined) updateData.instructions = instructions;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
    if (numQuestionsToServe !== undefined) updateData.numQuestionsToServe = numQuestionsToServe;
    if (positionType !== undefined) updateData.positionType = positionType;
    if (allowMultipleAttempts !== undefined) updateData.allowMultipleAttempts = allowMultipleAttempts;
    if (maxAttempts !== undefined) updateData.maxAttempts = maxAttempts === 0 ? null : maxAttempts;
    if (allowNegativeMarking !== undefined) updateData.allowNegativeMarking = allowNegativeMarking;
    if (negativeValue !== undefined) updateData.negativeValue = negativeValue;
    if (marksPerCorrect !== undefined) updateData.marksPerCorrect = marksPerCorrect;
    if (sbaMarks !== undefined) updateData.sbaMarks = sbaMarks;
    if (sbaNegative !== undefined) updateData.sbaNegative = sbaNegative;
    if (tfMarks !== undefined) updateData.tfMarks = tfMarks;
    if (tfNegative !== undefined) updateData.tfNegative = tfNegative;
    if (startDatetime !== undefined) updateData.startDatetime = startDatetime ? new Date(startDatetime).toISOString() : null;
    if (endDatetime !== undefined) updateData.endDatetime = endDatetime ? new Date(endDatetime).toISOString() : null;
    if (shuffleQuestions !== undefined) updateData.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions !== undefined) updateData.shuffleOptions = shuffleOptions;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'published' && (existingQuiz as any).status !== 'published') {
        updateData.publishedAt = new Date().toISOString();
      }
    }
    
    const { error: updateError } = await supabase
      .from('Quiz')
      // @ts-ignore
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;
      
    if (questions && Array.isArray(questions)) {
      const { data: existingQuestions = [] } = await supabase
        .from('Question')
        .select('id')
        .eq('quizId', id);

      const existingQuestionIds = new Set((existingQuestions || []).map((q: any) => q.id));

      const payloadQuestionIds = new Set(
        questions
          .map((q: any) => q.id)
          .filter((qId: string) => qId && !qId.startsWith('temp-'))
      );

      const questionsToDelete = (existingQuestions || []).filter((q: any) => !payloadQuestionIds.has(q.id));
      if (questionsToDelete.length > 0) {
        await supabase
          .from('Question')
          .delete()
          .in('id', questionsToDelete.map((q: any) => q.id));
      }

      const nowStr = new Date().toISOString();
      for (const q of questions) {
        let qType = q.questionType || 'sba';
        if (qType === 'mcq') qType = 'true_false';

        let correctOpt = (q.correctOption || '').trim().toUpperCase();
        if (qType === 'true_false' && correctOpt.length !== 5) {
          correctOpt = correctOpt.padEnd(5, 'F').slice(0, 5);
        }

        const questionData = {
          questionText: (q.questionText || '').trim(),
          questionType: qType,
          optionA: (q.optionA || '').trim(),
          optionB: (q.optionB || '').trim(),
          optionC: q.optionC?.trim() || null,
          optionD: q.optionD?.trim() || null,
          optionE: q.optionE?.trim() || null,
          correctOption: correctOpt,
          explanation: q.explanation?.trim() || null,
          updatedAt: nowStr,
        };

        if (q.id && existingQuestionIds.has(q.id)) {
          await supabase
            .from('Question')
            .update(questionData as any)
            .eq('id', q.id);
        } else {
          await supabase
            .from('Question')
            // @ts-ignore
            .insert({
              id: nanoid(),
              quizId: id,
              ...questionData,
              createdAt: nowStr,
            } as any);
        }
      }
    }

    // Recalculate all student attempt scores and rankings dynamically
    try {
      await recalculateQuizResults(id, supabase);
    } catch (recalcErr) {
      console.warn('Error during recalculateQuizResults on quiz update:', recalcErr);
    }
    
    const { data: updatedQuiz } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ quiz: updatedQuiz });
  } catch (error: any) {
    console.error('PUT /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
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
      return NextResponse.json({ error: 'Not authorized to delete this quiz.' }, { status: 403 });
    }
    
    const { error: deleteError } = await supabase
      .from('Quiz')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/quiz/[id] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}