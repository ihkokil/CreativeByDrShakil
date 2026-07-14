import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { quiz, quizCategory, question, quizAttempt, user } from '@/db/schema';
import { eq, desc, asc, and, or, ilike, sql, inArray, count, avg, max, min, sum } from 'drizzle-orm';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = await getAuthPayload(request);
    const isTeacher = payload && (payload.role === 'teacher' || payload.role === 'admin');
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    const offset = (page - 1) * limit;
    
    let whereConditions = [];
    
    if (!isTeacher) {
      whereConditions.push(eq(quiz.status, 'published'));
      if (searchParams.get('startDatetime')) {
        whereConditions.push(sql`${quiz.startDatetime} <= ${new Date(searchParams.get('startDatetime')!)}`);
      }
      if (searchParams.get('endDatetime')) {
        whereConditions.push(sql`${quiz.endDatetime} >= ${new Date(searchParams.get('endDatetime')!)}`);
      }
    } else if (payload.role === 'teacher') {
      whereConditions.push(eq(quiz.createdBy, payload.sub));
    }
    
    if (search) {
      whereConditions.push(ilike(quiz.title, `%${search}%`));
    }
    
    if (status && isTeacher) {
      whereConditions.push(eq(quiz.status, status as 'draft' | 'published' | 'archived'));
    }
    
    if (categoryId) {
      whereConditions.push(eq(quiz.categoryId, categoryId));
    }
    
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    let orderColumn;
    switch (sortBy) {
      case 'title':
        orderColumn = quiz.title;
        break;
      case 'durationMinutes':
        orderColumn = quiz.durationMinutes;
        break;
      case 'numQuestionsToServe':
        orderColumn = quiz.numQuestionsToServe;
        break;
      case 'createdAt':
      default:
        orderColumn = quiz.createdAt;
        break;
    }
    const orderFn = sortOrder === 'asc' ? asc : desc;
    
    const dbQuizzes = await db.query.quiz.findMany({
      where: whereClause,
      with: {
        category: true,
        creator: { columns: { id: true, fullName: true } },
        questions: { columns: { id: true } },
      },
      orderBy: orderFn(orderColumn),
      limit,
      offset,
    });
    
    const quizzes = dbQuizzes.map(q => ({
      ...q,
      _count: { questions: q.questions.length }
    }));
    
    let totalCount = 0;
    const countResult = await db.select({ count: count() }).from(quiz).where(whereClause);
    totalCount = countResult[0]?.count || 0;
    
    if (!isTeacher && payload && quizzes.length > 0) {
      const studentId = payload.sub;
      const attemptData = await db.query.quizAttempt.findMany({
        where: and(
          eq(quizAttempt.studentId, studentId),
          inArray(quizAttempt.quizId, quizzes.map(q => q.id))
        ),
        columns: { id: true, quizId: true, status: true, netScore: true, attemptNumber: true, submittedAt: true },
      });
      
      const quizAttemptsMap = new Map<string, any[]>();
      for (const attempt of attemptData) {
        if (!quizAttemptsMap.has(attempt.quizId)) {
          quizAttemptsMap.set(attempt.quizId, []);
        }
        quizAttemptsMap.get(attempt.quizId)!.push(attempt);
      }
      
      const quizzesWithStatus = quizzes.map(q => {
        const attempts = quizAttemptsMap.get(q.id) || [];
        const completedAttempts = attempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted');
        const inProgressAttempt = attempts.find(a => a.status === 'in_progress');
        
        let status = 'Not Attempted';
        if (attempts.length > 0) {
          if (inProgressAttempt) status = 'In Progress';
          else if (completedAttempts.length > 0) status = 'Completed';
        }
        
        const scores = completedAttempts.map(a => Number(a.netScore));
        const topScore = scores.length > 0 ? Math.max(...scores) : null;
        const avgScore = scores.length > 0 ? (scores.reduce((sum, val) => sum + val, 0) / scores.length) : null;
        const firstAttempt = completedAttempts.find(a => a.attemptNumber === 1);
        const firstAttemptScore = firstAttempt ? Number(firstAttempt.netScore) : null;
        const latestAttempt = attempts.length > 0 ? attempts.reduce((prev, curr) => prev.attemptNumber > curr.attemptNumber ? prev : curr) : null;
        
        return {
          ...q,
          status,
          attemptsCount: attempts.length,
          topScore,
          avgScore,
          firstAttemptScore,
          attempt: latestAttempt ? {
            id: latestAttempt.id,
            attemptNumber: latestAttempt.attemptNumber,
            score: latestAttempt.netScore,
            submittedAt: latestAttempt.submittedAt,
            status: latestAttempt.status,
          } : null,
        };
      });
      
      return NextResponse.json({
        quizzes: quizzesWithStatus,
        pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
      });
    }
    
    return NextResponse.json({
      quizzes,
      pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
    });
  } catch (error: any) {
    console.error('GET /api/quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized. Teacher or admin access required.' }, { status: 401 });
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
      startDatetime,
      endDatetime,
      shuffleQuestions,
      shuffleOptions,
      status,
    } = body;
    
    if (!title || !durationMinutes || !numQuestionsToServe) {
      return NextResponse.json({ error: 'Title, duration, and number of questions to serve are required.' }, { status: 400 });
    }
    
    if (categoryId) {
      const category = await db.query.quizCategory.findFirst({ where: eq(quizCategory.id, categoryId) });
      if (!category) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
    }
    
    const quizId = nanoid();
    const now = new Date();
    
    const nowStr = now.toISOString();
    const insertValues = {
      id: quizId,
      title: title.trim(),
      description: description || null,
      instructions: instructions || null,
      categoryId: categoryId || null,
      durationMinutes: durationMinutes || 0,
      numQuestionsToServe: numQuestionsToServe || 0,
      positionType: (positionType || 'best_attempt') as 'best_attempt' | 'last_attempt' | 'first_attempt',
      allowMultipleAttempts: allowMultipleAttempts || false,
      maxAttempts: maxAttempts || null,
      allowNegativeMarking: allowNegativeMarking || false,
      negativeValue: negativeValue || 0.25,
      marksPerCorrect: marksPerCorrect || 1,
      startDatetime: startDatetime ? new Date(startDatetime).toISOString() : null,
      endDatetime: endDatetime ? new Date(endDatetime).toISOString() : null,
      status: (status || 'draft') as 'draft' | 'published' | 'archived',
      shuffleQuestions: shuffleQuestions !== false,
      shuffleOptions: shuffleOptions !== false,
      createdBy: payload.sub,
      publishedAt: status === 'published' ? nowStr : null,
      createdAt: nowStr,
      updatedAt: nowStr,
    };

    await db.insert(quiz).values(insertValues);

    const newQuiz = insertValues;

    if (body.questions && Array.isArray(body.questions) && body.questions.length > 0) {
      const nowStr = now.toISOString();
      const questionsToInsert = body.questions.map((q: any) => ({
        id: nanoid(),
        quizId: quizId,
        questionText: q.questionText.trim(),
        questionType: q.questionType === 'true_false' ? 'true_false' : 'mcq',
        optionA: q.optionA.trim(),
        optionB: q.optionB.trim(),
        optionC: q.optionC?.trim() || null,
        optionD: q.optionD?.trim() || null,
        correctOption: q.correctOption.trim(),
        explanation: q.explanation?.trim() || null,
        createdAt: nowStr,
        updatedAt: nowStr,
      }));

      await db.insert(question).values(questionsToInsert);
    }
    
    return NextResponse.json({ quiz: newQuiz }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}