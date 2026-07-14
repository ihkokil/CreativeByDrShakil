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
    
    const quizData = await db.query.quiz.findFirst({
      where: eq(quiz.id, id),
    });
    
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
      const attempt = await db.query.quizAttempt.findFirst({
        where: and(
          eq(quizAttempt.quizId, id),
          eq(quizAttempt.studentId, payload.sub),
          or(
            eq(quizAttempt.status, 'submitted'),
            eq(quizAttempt.status, 'auto_submitted')
          )
        ),
        orderBy: (a, { desc }) => [desc(a.submittedAt)],
        with: {
          answers: true,
          questionMappings: { with: { question: true } },
          student: { columns: { id: true, fullName: true } },
        },
      });
      
      if (!attempt) {
        return NextResponse.json({ error: 'No completed attempt found.' }, { status: 404 });
      }
      
      const answerMap = new Map(attempt.answers.map(a => [a.questionId, a]));
      
      const questionsReview = attempt.questionMappings
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(m => {
          const q = m.question;
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
      
      const allAttempts = await db.query.quizAttempt.findMany({
        where: and(
          eq(quizAttempt.quizId, id),
          or(eq(quizAttempt.status, 'submitted'), eq(quizAttempt.status, 'auto_submitted'))
        ),
        with: {
          student: { columns: { fullName: true } }
        },
      });
      
      const attemptsByStudent = new Map<string, any[]>();
      for (const att of allAttempts) {
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
          id: attempt.id,
          netScore: attempt.netScore,
          percentageScore: attempt.percentageScore,
          correctCount: attempt.correctCount,
          wrongCount: attempt.wrongCount,
          skippedCount: attempt.skippedCount,
          negativeMarks: attempt.negativeMarks,
          timeTakenSeconds: attempt.timeTakenSeconds,
          submittedAt: attempt.submittedAt,
          attemptNumber: attempt.attemptNumber,
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
    
    const attempts = await db.query.quizAttempt.findMany({
      where: and(
        eq(quizAttempt.quizId, id),
        or(eq(quizAttempt.status, 'submitted'), eq(quizAttempt.status, 'auto_submitted'))
      ),
      with: {
        student: { columns: { id: true, fullName: true } },
        answers: true,
        questionMappings: { with: { question: true } },
      },
    });
    
    const teacherAttemptsByStudent = new Map<string, any[]>();
    for (const att of attempts) {
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
    
    const totalAttempts = attempts.length;
    const avgScore = totalAttempts > 0 
      ? attempts.reduce((sum, a) => sum + a.netScore, 0) / totalAttempts 
      : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...attempts.map(a => a.netScore)) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...attempts.map(a => a.netScore)) : 0;
    const avgTime = totalAttempts > 0 
      ? attempts.reduce((sum, a) => sum + (a.timeTakenSeconds || 0), 0) / totalAttempts 
      : 0;
    
    const questionStats = attempts.length > 0
      ? await db.query.question.findMany({
          where: eq(question.quizId, id),
          with: {
            attemptAnswers: {
              where: inArray(attemptAnswer.attemptId, attempts.map(a => a.id)),
            },
          },
        })
      : [];
    
    const perQuestionAnalytics = questionStats.map(q => {
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