import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
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

    const token = await extractCookieToken();


    const supabase = getSupabase(token);
    
    // We'll first get the count and IDs of the quizzes matching the filter
    let query = supabase.from('Quiz').select('id', { count: 'exact' });

    if (!isTeacher) {
      query = query.eq('status', 'published');
      if (searchParams.get('startDatetime')) {
        query = query.lte('startDatetime', new Date(searchParams.get('startDatetime')!).toISOString());
      }
      if (searchParams.get('endDatetime')) {
        query = query.gte('endDatetime', new Date(searchParams.get('endDatetime')!).toISOString());
      }
    } else if (payload?.role === 'teacher') {
      query = query.eq('createdBy', payload.sub);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (status && isTeacher) {
      query = query.eq('status', status as 'draft' | 'published' | 'archived');
    }

    if (categoryId) {
      query = query.eq('categoryId', categoryId);
    }

    let orderColumn = 'createdAt';
    switch (sortBy) {
      case 'title':
        orderColumn = 'title';
        break;
      case 'durationMinutes':
        orderColumn = 'durationMinutes';
        break;
      case 'numQuestionsToServe':
        orderColumn = 'numQuestionsToServe';
        break;
    }
    
    const { data: countData, count: totalCount, error: countError } = await query;
    if (countError) throw countError;
    
    const countValue = totalCount || 0;
    
    // Now fetch the actual data
    let dataQuery = supabase.from('Quiz').select('*');
    
    if (!isTeacher) {
      dataQuery = dataQuery.eq('status', 'published');
      if (searchParams.get('startDatetime')) {
        dataQuery = dataQuery.lte('startDatetime', new Date(searchParams.get('startDatetime')!).toISOString());
      }
      if (searchParams.get('endDatetime')) {
        dataQuery = dataQuery.gte('endDatetime', new Date(searchParams.get('endDatetime')!).toISOString());
      }
    } else if (payload?.role === 'teacher') {
      dataQuery = dataQuery.eq('createdBy', payload.sub);
    }

    if (search) {
      dataQuery = dataQuery.ilike('title', `%${search}%`);
    }

    if (status && isTeacher) {
      dataQuery = dataQuery.eq('status', status as 'draft' | 'published' | 'archived');
    }

    if (categoryId) {
      dataQuery = dataQuery.eq('categoryId', categoryId);
    }
    
    const { data: dbQuizzes = [], error: dataError } = await dataQuery
      .order(orderColumn, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);
      
    if (dataError) throw dataError;

    const categoryIds = (dbQuizzes || []).map((q: any) => q.categoryId).filter(Boolean);
    const creatorIds = (dbQuizzes || []).map((q: any) => q.createdBy);
    const quizIds = (dbQuizzes || []).map((q: any) => q.id);

    const [categoriesResponse, creatorsResponse, questionsResponse] = await Promise.all([
      categoryIds.length > 0 ? supabase.from('QuizCategory').select('*').in('id', categoryIds) : Promise.resolve({ data: [] }),
      creatorIds.length > 0 ? supabase.from('User').select('id, fullName').in('id', creatorIds) : Promise.resolve({ data: [] }),
      quizIds.length > 0 ? supabase.from('Question').select('quizId, id').in('quizId', quizIds) : Promise.resolve({ data: [] }),
    ]);

    const categories = categoriesResponse.data || [];
    const creators = creatorsResponse.data || [];
    const questions = questionsResponse.data || [];

    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
    const creatorMap = new Map(creators.map((c: any) => [c.id, c]));
    const questionsMap = new Map<string, { id: string }[]>();
    for (const q of questions) {
      const list = questionsMap.get((q as any).quizId) || [];
      list.push({ id: (q as any).id });
      questionsMap.set((q as any).quizId, list);
    }

    const quizzes = (dbQuizzes || []).map((q: any) => ({
      ...q,
      category: q.categoryId ? categoryMap.get(q.categoryId) || null : null,
      creator: creatorMap.get(q.createdBy) || null,
      questions: questionsMap.get(q.id) || [],
      _count: { questions: (questionsMap.get(q.id) || []).length }
    }));

    if (!isTeacher && payload && quizzes.length > 0) {
      const studentId = payload.sub;
      const { data: attemptData = [] } = await supabase
        .from('QuizAttempt')
        .select('id, quizId, status, netScore, attemptNumber, submittedAt')
        .eq('studentId', studentId)
        .in('quizId', quizzes.map(q => q.id));

      const quizAttemptsMap = new Map<string, any[]>();
      for (const attempt of attemptData || []) {
        if (!quizAttemptsMap.has((attempt as any).quizId)) {
          quizAttemptsMap.set((attempt as any).quizId, []);
        }
        quizAttemptsMap.get((attempt as any).quizId)!.push(attempt);
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
        pagination: { page, limit, total: countValue, totalPages: Math.ceil(countValue / limit) },
      });
    }

    return NextResponse.json({
      quizzes,
      pagination: { page, limit, total: countValue, totalPages: Math.ceil(countValue / limit) },
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

    const token = await extractCookieToken();


    const supabase = getSupabase(token);

    if (categoryId) {
      const { data: category } = await supabase.from('QuizCategory').select('id').eq('id', categoryId).limit(1).maybeSingle();
      if (!category) {
        return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
      }
    }

    const quizId = nanoid();
    const nowStr = new Date().toISOString();

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

    const { error: insertError } = await supabase.from('Quiz')
// @ts-ignore
.insert(insertValues as any);
    if (insertError) throw insertError;

    const newQuiz = insertValues;

    if (body.questions && Array.isArray(body.questions) && body.questions.length > 0) {
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

      const { error: questionsError } = await supabase.from('Question')
// @ts-ignore
.insert(questionsToInsert);
      if (questionsError) throw questionsError;
    }

    return NextResponse.json({ quiz: newQuiz }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/quiz error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}