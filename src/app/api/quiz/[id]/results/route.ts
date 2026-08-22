import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import {
  gradeAttemptData,
  calculateDynamicLeaderboard,
  getScoringRules,
  computeMaxMarksForQuestions,
  normalizeQuestionType,
  QuestionData,
} from '@/lib/quiz-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    const supabase = getSupabaseAdmin();
    
    if (!payload) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // 1. Fetch Quiz
    const { data: quizData, error: quizError } = await supabase
      .from('Quiz')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle();
    
    if (quizError || !quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    const isTeacher = payload.role === 'teacher' || payload.role === 'admin';
    const isStudent = payload.role === 'student';
    const attemptIdParam = request.nextUrl.searchParams.get('attempt');
    const viewParam = request.nextUrl.searchParams.get('view');
    
    // 2. Fetch all questions for this quiz
    const { data: rawQuestions } = await supabase
      .from('Question')
      .select('*')
      .eq('quizId', id)
      .order('createdAt', { ascending: true });

    const allQuestions: any[] = rawQuestions || [];
    const questionMap = new Map(allQuestions.map((q: any) => [q.id, q as QuestionData]));
    const scoring = getScoringRules(quizData);

    // If view is explicitly 'teacher' OR (user is teacher/admin and NO specific attempt is requested),
    // serve Teacher Analytics Overview.
    // Otherwise (student user, OR any user requesting a specific attempt without view='teacher', OR view='student'),
    // serve the Single Attempt Result with full questionsReview, answers, explanations, and dynamic rank!
    const isTeacherAnalyticsView = isTeacher && (viewParam === 'teacher' || (!attemptIdParam && viewParam !== 'student'));

    // -----------------------------------------------------------------
    // SINGLE ATTEMPT RESULT VIEW (Student or Teacher testing an attempt)
    // -----------------------------------------------------------------
    if (!isTeacherAnalyticsView) {
      let attemptQuery = supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id);

      if (attemptIdParam) {
        attemptQuery = attemptQuery.eq('id', attemptIdParam);
        // If regular student, ensure they only access their own attempt
        if (isStudent) {
          attemptQuery = attemptQuery.eq('studentId', payload.sub);
        }
      } else {
        attemptQuery = attemptQuery
          .eq('studentId', payload.sub)
          .in('status', ['submitted', 'auto_submitted'])
          .order('startedAt', { ascending: false });
      }

      const { data: attempt } = await attemptQuery.limit(1).maybeSingle();
      
      if (!attempt) {
        return NextResponse.json({ error: 'No completed attempt found.' }, { status: 404 });
      }

      // Fetch mappings and answers for this attempt
      const [{ data: attemptMappings = [] }, { data: attemptAnswers = [] }] = await Promise.all([
        supabase
          .from('QuizQuestionMapping')
          .select('*')
          .eq('attemptId', attempt.id)
          .order('displayOrder', { ascending: true }),
        supabase
          .from('AttemptAnswer')
          .select('*')
          .eq('attemptId', attempt.id),
      ]);

      let mappedQuestions: QuestionData[] = [];
      if (attemptMappings && attemptMappings.length > 0) {
        mappedQuestions = (attemptMappings || [])
          .map((m: any) => questionMap.get(m.questionId))
          .filter(Boolean) as QuestionData[];
      }
      if (mappedQuestions.length === 0) {
        mappedQuestions = (allQuestions || []) as QuestionData[];
      }

      // Grade attempt using unified engine
      const gradeSummary = gradeAttemptData(
        attempt.id,
        quizData,
        mappedQuestions,
        attemptAnswers || [],
        attempt.status as 'submitted' | 'auto_submitted',
        attempt.timeTakenSeconds || 0
      );

      // Build Question Review list with student's option order
      const mappingMap = new Map((attemptMappings || []).map((m: any) => [m.questionId, m]));
      const questionsReview = mappedQuestions.map((q, idx) => {
        const qRes = gradeSummary.questionResults[q.id];
        const mapping = mappingMap.get(q.id);
        const originalOptions = [
          { letter: 'A', text: q.optionA || '' },
          { letter: 'B', text: q.optionB || '' },
          { letter: 'C', text: q.optionC || '' },
          { letter: 'D', text: q.optionD || '' },
          { letter: 'E', text: q.optionE || '' },
        ];

        let orderedOptions = originalOptions;
        if (qRes.questionType === 'sba' && mapping?.optionOrder) {
          let orderKeys = mapping.optionOrder;
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
              if (!orderedLetters.has(o.letter)) orderedOptions.push(o);
            });
          }
        }

        return {
          questionId: q.id,
          displayOrder: mapping?.displayOrder || (idx + 1),
          questionText: q.questionText,
          questionType: qRes.questionType,
          options: orderedOptions,
          correctOption: q.correctOption,
          explanation: q.explanation || null,
          studentAnswer: qRes.studentAnswer,
          status: qRes.status,
          isCorrect: qRes.isCorrect,
          isPartial: qRes.isPartial,
          isSkipped: qRes.isSkipped,
          scoreGained: qRes.scoreGained,
          penalty: qRes.penalty,
          netScore: qRes.netScore,
          maxScore: qRes.maxScore,
          optionsReview: qRes.optionsReview || null,
        };
      });

      // Fetch all completed attempts for dynamic leaderboard
      const { data: allQuizAttempts = [] } = await supabase
        .from('QuizAttempt')
        .select('*')
        .eq('quizId', id)
        .in('status', ['submitted', 'auto_submitted']);

      const studentIds = [...new Set((allQuizAttempts || []).map((a: any) => a.studentId))];
      const { data: students = [] } = studentIds.length > 0
        ? await supabase.from('User').select('id, fullName').in('id', studentIds)
        : { data: [] };

      const studentMap = new Map((students || []).map((s: any) => [s.id, s]));
      const attemptsWithStudent = (allQuizAttempts || []).map((a: any) => ({
        ...a,
        student: studentMap.get(a.studentId) || null,
      }));

      const { leaderboard, userRank, totalParticipants } = calculateDynamicLeaderboard(
        quizData,
        attemptsWithStudent,
        payload.sub
      );

      const totalPossibleMarks = computeMaxMarksForQuestions(mappedQuestions, quizData);

      return NextResponse.json({
        attempt: {
          id: attempt.id,
          netScore: gradeSummary.netScore,
          grossScore: gradeSummary.grossScore,
          negativeMarks: gradeSummary.negativeMarks,
          maxScore: gradeSummary.maxScore,
          totalMarks: totalPossibleMarks,
          percentageScore: gradeSummary.percentageScore,
          correctCount: gradeSummary.correctCount,
          wrongCount: gradeSummary.wrongCount,
          partialCount: gradeSummary.partialCount,
          skippedCount: gradeSummary.skippedCount,
          timeTakenSeconds: attempt.timeTakenSeconds || 0,
          submittedAt: attempt.submittedAt,
          attemptNumber: attempt.attemptNumber,
          isAutoSubmitted: attempt.status === 'auto_submitted',
          rank: userRank,
          totalParticipants,
        },
        quiz: {
          id: quizData.id,
          title: quizData.title,
          description: quizData.description,
          sbaMarks: scoring.sbaMarks,
          sbaNegative: scoring.sbaNegative,
          tfMarks: scoring.tfMarks,
          tfNegative: scoring.tfNegative,
          totalMarks: totalPossibleMarks,
          numQuestionsToServe: quizData.numQuestionsToServe,
          durationMinutes: quizData.durationMinutes,
          positionType: quizData.positionType,
          allowMultipleAttempts: quizData.allowMultipleAttempts,
          maxAttempts: quizData.maxAttempts,
        },
        questionsReview,
        leaderboard,
      });
    }

    // -----------------------------------------------------------------
    // TEACHER VIEW
    // -----------------------------------------------------------------
    const { data: rawAttempts } = await supabase
      .from('QuizAttempt')
      .select('*')
      .eq('quizId', id)
      .in('status', ['submitted', 'auto_submitted'])
      .order('submittedAt', { ascending: false });

    const attempts = rawAttempts || [];

    const studentIds = [...new Set(attempts.map((a: any) => a.studentId))];
    const { data: rawStudents } = studentIds.length > 0
      ? await supabase.from('User').select('id, fullName, email').in('id', studentIds)
      : { data: [] };

    const students = rawStudents || [];
    const studentMap = new Map(students.map((s: any) => [s.id, s]));

    const attemptsWithStudent = attempts.map((a: any) => {
      const stu = studentMap.get(a.studentId);
      return {
        ...a,
        student: stu || null,
        studentName: stu?.fullName || 'Student',
      };
    });

    const { leaderboard } = calculateDynamicLeaderboard(
      quizData,
      attemptsWithStudent,
      null
    );

    // Build overall summary stats
    const totalAttempts = attempts.length;
    const scores = attempts.map((a: any) => Number(a.netScore || 0));
    const averageScore = scores.length > 0 ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : 0;
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
    const times = attempts.map((a: any) => Number(a.timeTakenSeconds || 0));
    const averageTimeSeconds = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

    // All submissions list
    const allSubmissions = attemptsWithStudent.map((a: any) => ({
      attemptId: a.id,
      studentId: a.studentId,
      studentName: a.student?.fullName || 'Student',
      studentEmail: a.student?.email || null,
      netScore: Number(a.netScore || 0),
      percentageScore: Number(a.percentageScore || 0),
      correctCount: Number(a.correctCount || 0),
      wrongCount: Number(a.wrongCount || 0),
      skippedCount: Number(a.skippedCount || 0),
      timeTakenSeconds: a.timeTakenSeconds,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber,
      isAutoSubmitted: a.status === 'auto_submitted',
    }));

    // If specific attempt is requested by teacher for detailed review
    const selectedAttemptId = request.nextUrl.searchParams.get('attempt');
    let selectedAttemptDetail = null;

    if (selectedAttemptId) {
      const selectedAtt = attemptsWithStudent.find((a: any) => a.id === selectedAttemptId);
      if (selectedAtt) {
        const [{ data: attMappings = [] }, { data: attAnswers = [] }] = await Promise.all([
          supabase.from('QuizQuestionMapping').select('*').eq('attemptId', selectedAtt.id).order('displayOrder', { ascending: true }),
          supabase.from('AttemptAnswer').select('*').eq('attemptId', selectedAtt.id),
        ]);

        let mappedQuestions: QuestionData[] = [];
        if (attMappings && attMappings.length > 0) {
          mappedQuestions = attMappings
            .map((m: any) => questionMap.get(m.questionId))
            .filter(Boolean) as QuestionData[];
        }
        if (mappedQuestions.length === 0) {
          mappedQuestions = (allQuestions || []) as QuestionData[];
        }

        const gradeSummary = gradeAttemptData(
          selectedAtt.id,
          quizData,
          mappedQuestions,
          attAnswers || [],
          selectedAtt.status as 'submitted' | 'auto_submitted',
          selectedAtt.timeTakenSeconds || 0
        );

        const mappingMap = new Map((attMappings || []).map((m: any) => [m.questionId, m]));
        const questionsReview = mappedQuestions.map((q, idx) => {
          const qRes = gradeSummary.questionResults[q.id];
          const mapping = mappingMap.get(q.id);
          return {
            questionId: q.id,
            displayOrder: mapping?.displayOrder || (idx + 1),
            questionText: q.questionText,
            questionType: qRes.questionType,
            options: [
              { letter: 'A', text: q.optionA || '' },
              { letter: 'B', text: q.optionB || '' },
              { letter: 'C', text: q.optionC || '' },
              { letter: 'D', text: q.optionD || '' },
              { letter: 'E', text: q.optionE || '' },
            ],
            correctOption: q.correctOption,
            explanation: q.explanation || null,
            studentAnswer: qRes.studentAnswer,
            status: qRes.status,
            isCorrect: qRes.isCorrect,
            isPartial: qRes.isPartial,
            isSkipped: qRes.isSkipped,
            scoreGained: qRes.scoreGained,
            penalty: qRes.penalty,
            netScore: qRes.netScore,
            maxScore: qRes.maxScore,
            optionsReview: qRes.optionsReview || null,
          };
        });

        selectedAttemptDetail = {
          id: selectedAtt.id,
          studentId: selectedAtt.studentId,
          studentName: selectedAtt.studentName,
          netScore: gradeSummary.netScore,
          grossScore: gradeSummary.grossScore,
          negativeMarks: gradeSummary.negativeMarks,
          maxScore: gradeSummary.maxScore,
          percentageScore: gradeSummary.percentageScore,
          correctCount: gradeSummary.correctCount,
          wrongCount: gradeSummary.wrongCount,
          partialCount: gradeSummary.partialCount,
          skippedCount: gradeSummary.skippedCount,
          timeTakenSeconds: selectedAtt.timeTakenSeconds,
          submittedAt: selectedAtt.submittedAt,
          attemptNumber: selectedAtt.attemptNumber,
          isAutoSubmitted: selectedAtt.status === 'auto_submitted',
          questionsReview,
        };
      }
    }

    // Per-question analytics across all attempts
    const { data: allAnswers = [] } = attempts.length > 0
      ? await supabase.from('AttemptAnswer').select('*').in('attemptId', attempts.map((a: any) => a.id))
      : { data: [] };

    const answersByQuestion = new Map<string, any[]>();
    for (const a of (allAnswers || [])) {
      const list = answersByQuestion.get(a.questionId) || [];
      list.push(a);
      answersByQuestion.set(a.questionId, list);
    }

    const perQuestionAnalytics = (allQuestions || []).map((q: any) => {
      const qAnswers = answersByQuestion.get(q.id) || [];
      const totalQAttempts = qAnswers.length;
      const qType = normalizeQuestionType(q.questionType);

      let correctAnswersCount = 0;
      let optionDistribution: any;

      if (qType === 'sba') {
        optionDistribution = { A: 0, B: 0, C: 0, D: 0, E: 0 };
        for (const ans of qAnswers) {
          const sel = (ans.selectedOption || '').trim().toUpperCase();
          if (sel && optionDistribution[sel] !== undefined) {
            optionDistribution[sel]++;
          }
          if (sel === (q.correctOption || '').trim().toUpperCase()) {
            correctAnswersCount++;
          }
        }
      } else {
        const stems = ['A', 'B', 'C', 'D', 'E'];
        optionDistribution = {
          A: { T: 0, F: 0, S: 0 },
          B: { T: 0, F: 0, S: 0 },
          C: { T: 0, F: 0, S: 0 },
          D: { T: 0, F: 0, S: 0 },
          E: { T: 0, F: 0, S: 0 },
        };
        const cOpt = (q.correctOption || '').trim().toUpperCase().padEnd(5, 'F');
        for (const ans of qAnswers) {
          const sel = (ans.selectedOption || '').trim().toUpperCase().padEnd(5, '-');
          let correctStems = 0;
          for (let i = 0; i < 5; i++) {
            const char = sel[i];
            const stem = stems[i];
            if (char === 'T') {
              optionDistribution[stem].T++;
            } else if (char === 'F') {
              optionDistribution[stem].F++;
            } else {
              optionDistribution[stem].S++;
            }
            if (char === cOpt[i]) {
              correctStems++;
            }
          }
          if (correctStems === 5) {
            correctAnswersCount++;
          }
        }
      }

      const correctPercentage = totalQAttempts > 0
        ? Math.round((correctAnswersCount / totalQAttempts) * 100)
        : 0;

      return {
        questionId: q.id,
        questionType: qType,
        questionText: q.questionText,
        totalAttempts: totalQAttempts,
        correctCount: correctAnswersCount,
        correctPercentage,
        optionDistribution,
        options: [
          { letter: 'A', text: q.optionA || '' },
          { letter: 'B', text: q.optionB || '' },
          { letter: 'C', text: q.optionC || '' },
          { letter: 'D', text: q.optionD || '' },
          { letter: 'E', text: q.optionE || '' },
        ],
        correctOption: q.correctOption,
      };
    });

    const totalQuizMarks = computeMaxMarksForQuestions(allQuestions as QuestionData[], quizData);

    return NextResponse.json({
      quiz: {
        id: quizData.id,
        title: quizData.title,
        totalQuestions: allQuestions.length,
        durationMinutes: quizData.durationMinutes,
        sbaMarks: scoring.sbaMarks,
        sbaNegative: scoring.sbaNegative,
        tfMarks: scoring.tfMarks,
        tfNegative: scoring.tfNegative,
        totalMarks: totalQuizMarks,
      },
      summary: {
        totalAttempts,
        uniqueStudents: studentIds.length,
        averageScore,
        highestScore,
        lowestScore,
        averageTimeSeconds,
      },
      leaderboard,
      allSubmissions,
      perQuestionAnalytics,
      attempt: selectedAttemptDetail,
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/results error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}