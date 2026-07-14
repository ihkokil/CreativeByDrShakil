import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, quizAttempt, attemptAnswer, question, user, quizQuestionMapping } from '@/db/schema';
import { eq, and, desc, asc, sql, count, avg, max, min, or, inArray } from 'drizzle-orm';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payload = await getAuthPayload(request);
    
    const [quizData] = await db.select().from(quiz).where(eq(quiz.id, id)).limit(1);
    
    if (!quizData) {
      return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    }
    
    const isTeacher = payload && (payload.role === 'teacher' || payload.role === 'admin');
    const isStudent = payload && payload.role === 'student';
    
    if (!isTeacher && !isStudent) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    
    if (isTeacher && payload.role === 'teacher' && quizData.createdBy !== payload.sub) {
      return NextResponse.json({ error: 'Not authorized to view results for this quiz.' }, { status: 403 });
    }
    
    if (isStudent) {
      const [attempt] = await db.select().from(quizAttempt).where(and(
        eq(quizAttempt.quizId, id),
        eq(quizAttempt.studentId, payload.sub),
        or(
          eq(quizAttempt.status, 'submitted'),
          eq(quizAttempt.status, 'auto_submitted')
        )
      )).orderBy(desc(quizAttempt.submittedAt)).limit(1);
      
      if (!attempt) {
        return NextResponse.json({ error: 'No completed attempt found.' }, { status: 404 });
      }
      
      const [attemptAnswers, attemptMappings] = await Promise.all([
        db.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, attempt.id)),
        db.select().from(quizQuestionMapping).where(eq(quizQuestionMapping.attemptId, attempt.id)),
      ]);
      
      const mappingQuestionIds = attemptMappings.map(m => m.questionId);
      const mappingQuestions = mappingQuestionIds.length > 0
        ? await db.select().from(question).where(inArray(question.id, mappingQuestionIds))
        : [];
      const mappingQuestionMap = new Map(mappingQuestions.map(q => [q.id, q]));
      
      const attemptWithRelations = {
        ...attempt,
        answers: attemptAnswers,
        questionMappings: attemptMappings.map(m => ({
          ...m,
          question: mappingQuestionMap.get(m.questionId)!,
        })),
      };
      
      const answerMap = new Map(attemptWithRelations.answers.map(a => [a.questionId, a]));
      
      const questionsReview = attemptWithRelations.questionMappings
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(m => {
          const q = m.question!;
          const answer = answerMap.get(q.id);
          const options = [
            { letter: 'A', text: q.optionA },
            { letter: 'B', text: q.optionB },
            { letter: 'C', text: q.optionC },
            { letter: 'D', text: q.optionD },
          ].filter(o => o.text !== null && o.text !== undefined && o.text !== '');
          
          return {
            questionId: q.id,
            questionText: q.questionText,
            questionType: q.questionType,
            options,
            correctOption: q.correctOption,
            explanation: q.explanation,
            studentAnswer: answer?.selectedOption || null,
            isCorrect: answer?.isCorrect || false,
            isSkipped: !answer?.selectedOption,
          };
        });
      
      const allAttempts = await db.select().from(quizAttempt).where(and(
        eq(quizAttempt.quizId, id),
        or(eq(quizAttempt.status, 'submitted'), eq(quizAttempt.status, 'auto_submitted'))
      ));
      
      const allAttemptStudentIds = [...new Set(allAttempts.map(a => a.studentId))];
      const allAttemptStudents = allAttemptStudentIds.length > 0
        ? await db.select({ id: user.id, fullName: user.fullName }).from(user).where(inArray(user.id, allAttemptStudentIds))
        : [];
      const allAttemptStudentMap = new Map(allAttemptStudents.map(s => [s.id, s]));
      const allAttemptsWithStudent = allAttempts.map(a => ({
        ...a,
        student: allAttemptStudentMap.get(a.studentId) || null,
      }));
      
      const attemptsByStudent = new Map<string, any[]>();
      for (const att of allAttemptsWithStudent) {
        if (!attemptsByStudent.has(att.studentId)) {
          attemptsByStudent.set(att.studentId, []);
        }
        attemptsByStudent.get(att.studentId)!.push(att);
      }
      
      const filteredAttempts: any[] = [];
      const rankingType = quizData.positionType || 'best_attempt';
      
      attemptsByStudent.forEach((studentAttempts) => {
        studentAttempts.sort((a, b) => {
          if (rankingType === 'first_attempt') {
            return a.attemptNumber - b.attemptNumber;
          }
          if (rankingType === 'last_attempt') {
            return b.attemptNumber - a.attemptNumber;
          }
          if (b.netScore !== a.netScore) {
            return b.netScore - a.netScore;
          }
          return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
        });
        filteredAttempts.push(studentAttempts[0]);
      });
      
      filteredAttempts.sort((a, b) => {
        if (b.netScore !== a.netScore) {
          return b.netScore - a.netScore;
        }
        return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
      });
      
      const studentAttemptIndex = filteredAttempts.findIndex(a => a.studentId === payload.sub);
      const rank = studentAttemptIndex >= 0 ? studentAttemptIndex + 1 : null;
      
      const leaderboard = filteredAttempts.slice(0, 20).map((a, idx) => ({
        rank: idx + 1,
        studentName: a.student?.fullName || 'Unknown',
        netScore: a.netScore,
        timeTakenSeconds: a.timeTakenSeconds,
        attemptNumber: a.attemptNumber,
        isCurrentUser: a.studentId === payload.sub,
      }));
      
      return NextResponse.json({
        attempt: {
          id: attemptWithRelations.id,
          netScore: attemptWithRelations.netScore,
          percentageScore: attemptWithRelations.percentageScore,
          correctCount: attemptWithRelations.correctCount,
          wrongCount: attemptWithRelations.wrongCount,
          skippedCount: attemptWithRelations.skippedCount,
          negativeMarks: attemptWithRelations.negativeMarks,
          timeTakenSeconds: attemptWithRelations.timeTakenSeconds,
          submittedAt: attemptWithRelations.submittedAt,
          attemptNumber: attemptWithRelations.attemptNumber,
          rank,
        },
        quiz: {
          id: quizData.id,
          title: quizData.title,
          marksPerCorrect: quizData.marksPerCorrect,
          allowNegativeMarking: quizData.allowNegativeMarking,
          negativeValue: quizData.negativeValue,
          allowMultipleAttempts: quizData.allowMultipleAttempts,
          maxAttempts: quizData.maxAttempts,
          durationMinutes: quizData.durationMinutes,
        },
        questionsReview,
        leaderboard,
      });
    }
    
    const attempts = await db.select().from(quizAttempt).where(and(
      eq(quizAttempt.quizId, id),
      or(eq(quizAttempt.status, 'submitted'), eq(quizAttempt.status, 'auto_submitted'))
    ));
    
    const attemptIds = attempts.map(a => a.id);
    const attemptStudentIds = [...new Set(attempts.map(a => a.studentId))];
    
    const [attemptStudents, attemptAnswers, attemptMappings] = await Promise.all([
      attemptStudentIds.length > 0
        ? db.select({ id: user.id, fullName: user.fullName }).from(user).where(inArray(user.id, attemptStudentIds))
        : [],
      attemptIds.length > 0
        ? db.select().from(attemptAnswer).where(inArray(attemptAnswer.attemptId, attemptIds))
        : [],
      attemptIds.length > 0
        ? db.select().from(quizQuestionMapping).where(inArray(quizQuestionMapping.attemptId, attemptIds))
        : [],
    ]);
    
    const attemptStudentMap = new Map(attemptStudents.map(s => [s.id, s]));
    
    const mappingQuestionIds = [...new Set(attemptMappings.map(m => m.questionId))];
    const mappingQuestions = mappingQuestionIds.length > 0
      ? await db.select().from(question).where(inArray(question.id, mappingQuestionIds))
      : [];
    const mappingQuestionMap = new Map(mappingQuestions.map(q => [q.id, q]));
    
    const attemptsAnswerMap = new Map<string, any[]>();
    for (const a of attemptAnswers) {
      const list = attemptsAnswerMap.get(a.attemptId) || [];
      list.push(a);
      attemptsAnswerMap.set(a.attemptId, list);
    }
    
    const attemptsMappingMap = new Map<string, any[]>();
    for (const m of attemptMappings) {
      const list = attemptsMappingMap.get(m.attemptId) || [];
      list.push({ ...m, question: mappingQuestionMap.get(m.questionId)! });
      attemptsMappingMap.set(m.attemptId, list);
    }
    
    const attemptsWithRelations = attempts.map(a => ({
      ...a,
      student: attemptStudentMap.get(a.studentId) || null,
      answers: attemptsAnswerMap.get(a.id) || [],
      questionMappings: attemptsMappingMap.get(a.id) || [],
    }));
    
    const teacherAttemptsByStudent = new Map<string, any[]>();
    for (const att of attemptsWithRelations) {
      if (!teacherAttemptsByStudent.has(att.studentId)) {
        teacherAttemptsByStudent.set(att.studentId, []);
      }
      teacherAttemptsByStudent.get(att.studentId)!.push(att);
    }
    
    const teacherFilteredAttempts: any[] = [];
    const teacherRankingType = quizData.positionType || 'best_attempt';
    
    teacherAttemptsByStudent.forEach((studentAttempts) => {
      studentAttempts.sort((a, b) => {
        if (teacherRankingType === 'first_attempt') {
          return a.attemptNumber - b.attemptNumber;
        }
        if (teacherRankingType === 'last_attempt') {
          return b.attemptNumber - a.attemptNumber;
        }
        if (b.netScore !== a.netScore) {
          return b.netScore - a.netScore;
        }
        return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
      });
      teacherFilteredAttempts.push(studentAttempts[0]);
    });
    
    teacherFilteredAttempts.sort((a, b) => {
      if (b.netScore !== a.netScore) {
        return b.netScore - a.netScore;
      }
      return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
    });
    
    const leaderboard = teacherFilteredAttempts.map((a, idx) => ({
      rank: idx + 1,
      attemptId: a.id,
      studentId: a.studentId,
      studentName: a.student?.fullName || 'Unknown',
      netScore: a.netScore,
      percentageScore: a.percentageScore,
      correctCount: a.correctCount,
      wrongCount: a.wrongCount,
      skippedCount: a.skippedCount,
      timeTakenSeconds: a.timeTakenSeconds,
      submittedAt: a.submittedAt,
      attemptNumber: a.attemptNumber,
      isAutoSubmitted: a.status === 'auto_submitted',
    }));
    
    const totalAttempts = attemptsWithRelations.length;
    const avgScore = totalAttempts > 0 
      ? attemptsWithRelations.reduce((sum, a) => sum + a.netScore, 0) / totalAttempts 
      : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...attemptsWithRelations.map(a => a.netScore)) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...attemptsWithRelations.map(a => a.netScore)) : 0;
    const avgTime = totalAttempts > 0 
      ? attemptsWithRelations.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0) / totalAttempts 
      : 0;
    
    const questionStats = attemptsWithRelations.length > 0
      ? await db.select().from(question).where(eq(question.quizId, id))
      : [];
    const questionStatIds = questionStats.map(q => q.id);
    const questionStatAttemptIds = attemptsWithRelations.map(a => a.id);
    const questionStatAnswers = questionStatIds.length > 0 && questionStatAttemptIds.length > 0
      ? await db.select().from(attemptAnswer).where(and(inArray(attemptAnswer.questionId, questionStatIds), inArray(attemptAnswer.attemptId, questionStatAttemptIds)))
      : [];
    const questionStatAnswerMap = new Map<string, any[]>();
    for (const a of questionStatAnswers) {
      const list = questionStatAnswerMap.get(a.questionId) || [];
      list.push(a);
      questionStatAnswerMap.set(a.questionId, list);
    }
    const questionStatsWithAnswers = questionStats.map(q => ({
      ...q,
      attemptAnswers: questionStatAnswerMap.get(q.id) || [],
    }));
    
    const perQuestionAnalytics = questionStatsWithAnswers.map(q => {
      const answers = q.attemptAnswers;
      const total = answers.length;
      const correct = answers.filter(a => a.isCorrect).length;
      const optionCounts = { A: 0, B: 0, C: 0, D: 0 };
      
      for (const a of answers) {
        if (a.selectedOption) {
          optionCounts[a.selectedOption as keyof typeof optionCounts] = 
            (optionCounts[a.selectedOption as keyof typeof optionCounts] || 0) + 1;
        }
      }
      
      return {
        questionId: q.id,
        questionText: q.questionText,
        totalAttempts: total,
        correctCount: correct,
        correctPercentage: total > 0 ? (correct / total) * 100 : 0,
        optionDistribution: optionCounts,
        mostCommonWrongOption: Object.entries(optionCounts)
          .filter(([opt]) => opt !== q.correctOption)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      };
    });
    
    return NextResponse.json({
      quiz: {
        id: quizData.id,
        title: quizData.title,
        totalQuestions: quizData.numQuestionsToServe,
        durationMinutes: quizData.durationMinutes,
      },
      summary: {
        totalAttempts,
        averageScore: avgScore,
        highestScore,
        lowestScore,
        averageTimeSeconds: avgTime,
      },
      leaderboard,
      perQuestionAnalytics,
    });
  } catch (error: any) {
    console.error('GET /api/quiz/[id]/results error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}