import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, getSupabaseAdmin } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload, requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import {
  parseCurriculumJson,
  ensureGroupInheritance,
  collectSecondChildGroups,
  parseReleaseGroupDateMap,
  computeReleaseGroupDates,
  annotateCurriculumAvailability,
} from '@/lib/teacher-course-builder';

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
    const courseIdFilter = searchParams.get('courseId') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;
    const token = await extractCookieToken();
    const supabase = getSupabaseAdmin();

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

    // -------------------------------------------------------------
    // STUDENT PATH: Quizzes must be from student's enrolled courses
    // -------------------------------------------------------------
    if (!isTeacher) {
      if (!payload) {
        return NextResponse.json({ quizzes: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
      }

      // 1. Find all approved orders for this student
      const { data: orders = [] } = await supabase
        .from('Order')
        .select('courseId, enrolledAt, batchId, updatedAt')
        .eq('userId', payload.sub)
        .eq('status', 'approved');

      if (!orders || orders.length === 0) {
        return NextResponse.json({ quizzes: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
      }

      let enrolledCourseIds = Array.from(new Set((orders || []).map((o: any) => o.courseId)));
      if (courseIdFilter) {
        enrolledCourseIds = enrolledCourseIds.filter(id => id === courseIdFilter);
        if (enrolledCourseIds.length === 0) {
          return NextResponse.json({ quizzes: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
        }
      }

      // 2. Fetch CourseQuiz links for enrolled courses
      const { data: courseQuizLinks = [] } = await supabase
        .from('CourseQuiz')
        .select('id, quizId, courseId, curriculumNodeId, sortOrder')
        .in('courseId', enrolledCourseIds);

      if (!courseQuizLinks || courseQuizLinks.length === 0) {
        return NextResponse.json({ quizzes: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
      }

      const linkedQuizIds = Array.from(new Set(courseQuizLinks.map((cq: any) => cq.quizId)));

      // 3. Fetch Course details for module availability calculation
      const { data: courseRows = [] } = await supabase
        .from('Course')
        .select('id, title, slug, releaseMode, releaseStartAt, releaseIntervalDays, releaseGroupsPerWeek, releaseDaysOfWeek, releaseGroupDates, curriculumJson, courseStartDate')
        .in('id', enrolledCourseIds);

      const courseMap = new Map((courseRows || []).map((c: any) => [c.id, c]));

      // 4. Fetch StudentModuleAvailability overrides & Batch info
      const [{ data: overrideRows = [] }, { data: batchRows = [] }] = await Promise.all([
        supabase
          .from('StudentModuleAvailability')
          .select('courseId, lessonNodeId, availabilityMode, availableAt')
          .eq('userId', payload.sub)
          .in('courseId', enrolledCourseIds),
        supabase
          .from('Batch')
          .select('id, name, startDate')
          .in('id', (orders || []).map((o: any) => o.batchId).filter(Boolean)),
      ]);

      const batchMap = new Map((batchRows || []).map((b: any) => [b.id, b]));

      // Calculate availability map per (courseId, curriculumNodeId)
      const availabilityMap = new Map<string, { isLocked: boolean; availableAt: string | null; moduleName: string }>();

      for (const order of orders || []) {
        const c = courseMap.get((order as any).courseId);
        if (!c) continue;

        const rawCurriculum = parseCurriculumJson(c.curriculumJson);
        const curriculum = ensureGroupInheritance(rawCurriculum);
        const groups = collectSecondChildGroups(curriculum);
        const releaseGroupDates = parseReleaseGroupDateMap(c.releaseGroupDates);

        let enrolledAt = (order as any).enrolledAt || (order as any).updatedAt;
        const studentBatch = (order as any).batchId ? batchMap.get((order as any).batchId) : null;
        let effectiveReleaseMode = c.releaseMode || 'custom_batch';
        let releaseStart = enrolledAt || c.releaseStartAt || c.courseStartDate || new Date().toISOString();

        if (studentBatch) {
          const bName = ((studentBatch as any).name || '').toLowerCase();
          if (bName.includes('instant')) {
            effectiveReleaseMode = 'instant';
          } else if (bName.includes('custom')) {
            effectiveReleaseMode = 'custom_batch';
            releaseStart = enrolledAt || new Date().toISOString();
          } else if ((studentBatch as any).startDate) {
            effectiveReleaseMode = c.releaseMode || 'circular';
            releaseStart = (studentBatch as any).startDate;
          }
        }

        let releaseDaysOfWeek: number[] | null = null;
        if (c.releaseDaysOfWeek) {
          if (typeof c.releaseDaysOfWeek === 'string') {
            try { releaseDaysOfWeek = JSON.parse(c.releaseDaysOfWeek); } catch { releaseDaysOfWeek = null; }
          } else if (Array.isArray(c.releaseDaysOfWeek)) {
            releaseDaysOfWeek = c.releaseDaysOfWeek;
          }
        }

        const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
          releaseMode: effectiveReleaseMode,
          releaseStartAt: releaseStart,
          releaseIntervalDays: c.releaseIntervalDays,
          releaseGroupsPerWeek: c.releaseGroupsPerWeek,
          releaseDaysOfWeek,
          releaseGroupDates,
        });

        const courseOverrides = (overrideRows || [])
          .filter((row: any) => row.courseId === c.id)
          .map((row: any) => ({
            lessonNodeId: row.lessonNodeId,
            availabilityMode: row.availabilityMode,
            availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
          }));

        const annotated = annotateCurriculumAvailability(curriculum, computedReleaseGroupDates, new Date(), courseOverrides);

        const indexNodes = (nodes: any[], parentAvail?: { isLocked: boolean; availableAt: string | null; moduleName: string }) => {
          for (const n of nodes) {
            const nodeAvail = {
              isLocked: Boolean(n.locked),
              availableAt: n.availableAt || null,
              moduleName: n.title || 'Module',
            };
            const effectiveAvail = parentAvail?.isLocked ? parentAvail : nodeAvail;
            availabilityMap.set(`${c.id}_${n.id}`, effectiveAvail);
            if (n.mediaVaultFolderId) {
              availabilityMap.set(`${c.id}_${n.mediaVaultFolderId}`, effectiveAvail);
            }
            if (n.children && Array.isArray(n.children)) {
              indexNodes(n.children, effectiveAvail);
            }
          }
        };
        indexNodes(annotated);
      }

      // Fetch VideoLibraryNode structure for mapping subfolders
      const { data: vaultNodes = [] } = await supabase
        .from('VideoLibraryNode')
        .select('id, parentId, title, type');
      const vaultMap = new Map((vaultNodes || []).map((vn: any) => [vn.id, vn]));

      // Query published quizzes
      let quizQuery = supabase
        .from('Quiz')
        .select('*', { count: 'exact' })
        .in('id', linkedQuizIds)
        .eq('status', 'published');

      if (search) {
        quizQuery = quizQuery.ilike('title', `%${search}%`);
      }

      if (categoryId) {
        quizQuery = quizQuery.eq('categoryId', categoryId);
      }

      const { data: dbQuizzes = [], count: totalCount, error: qErr } = await quizQuery
        .order(orderColumn, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (qErr) throw qErr;

      const quizIds = (dbQuizzes || []).map((q: any) => q.id);
      const [{ data: questions = [] }, { data: attempts = [] }] = await Promise.all([
        quizIds.length > 0 ? supabase.from('Question').select('quizId, id').in('quizId', quizIds) : Promise.resolve({ data: [] }),
        quizIds.length > 0 ? supabase.from('QuizAttempt').select('id, quizId, status, netScore, attemptNumber, submittedAt').eq('studentId', payload.sub).in('quizId', quizIds) : Promise.resolve({ data: [] }),
      ]);

      const questionsMap = new Map<string, number>();
      for (const q of questions || []) {
        questionsMap.set((q as any).quizId, (questionsMap.get((q as any).quizId) || 0) + 1);
      }

      const attemptsMap = new Map<string, any[]>();
      for (const a of attempts || []) {
        const qId = (a as any).quizId;
        if (!attemptsMap.has(qId)) attemptsMap.set(qId, []);
        attemptsMap.get(qId)!.push(a);
      }

      let result = (dbQuizzes || []).map((q: any) => {
        const link = (courseQuizLinks || []).find((cq: any) => cq.quizId === q.id);
        const course = link ? courseMap.get(link.courseId) : null;
        let isLocked = false;
        let availableAt: string | null = null;
        let moduleName = 'All Quizes';

        if (link && link.curriculumNodeId) {
          let avail = availabilityMap.get(`${link.courseId}_${link.curriculumNodeId}`);
          if (!avail) {
            let currVaultId = link.curriculumNodeId;
            while (currVaultId && !avail) {
              const vNode = vaultMap.get(currVaultId);
              if (vNode) {
                avail = availabilityMap.get(`${link.courseId}_${vNode.id}`);
                if (!avail && vNode.parentId) {
                  currVaultId = vNode.parentId;
                  continue;
                }
              }
              break;
            }
          }

          if (avail) {
            isLocked = avail.isLocked;
            availableAt = avail.availableAt;
            moduleName = avail.moduleName;
          } else {
            const vNode = vaultMap.get(link.curriculumNodeId);
            if (vNode && (String(vNode.title).trim().toLowerCase() === 'all quizes' || String(vNode.title).trim().toLowerCase() === 'all quizzes')) {
              isLocked = false;
              availableAt = null;
              moduleName = 'All Quizes';
            } else if (vNode) {
              moduleName = vNode.title;
            }
          }
        }

        const userAttempts = attemptsMap.get(q.id) || [];
        const completedAttempts = userAttempts.filter((a: any) => a.status === 'submitted' || a.status === 'auto_submitted');
        const inProgressAttempt = userAttempts.find((a: any) => a.status === 'in_progress');

        let quizStatus = 'Not Attempted';
        if (userAttempts.length > 0) {
          if (inProgressAttempt) quizStatus = 'In Progress';
          else if (completedAttempts.length > 0) quizStatus = 'Completed';
        }

        const scores = completedAttempts.map((a: any) => Number(a.netScore));
        const topScore = scores.length > 0 ? Math.max(...scores) : null;
        const avgScore = scores.length > 0 ? (scores.reduce((sum: number, val: number) => sum + val, 0) / scores.length) : null;
        const firstAttempt = completedAttempts.find((a: any) => a.attemptNumber === 1);
        const firstAttemptScore = firstAttempt ? Number(firstAttempt.netScore) : null;
        const latestAttempt = userAttempts.length > 0 ? userAttempts.reduce((prev: any, curr: any) => prev.attemptNumber > curr.attemptNumber ? prev : curr) : null;

        return {
          ...q,
          courseId: course?.id || null,
          courseName: course?.title || null,
          courseSlug: course?.slug || null,
          moduleName,
          curriculumNodeId: link?.curriculumNodeId || null,
          isLocked,
          availableAt,
          status: quizStatus,
          attemptsCount: userAttempts.length,
          topScore,
          avgScore,
          firstAttemptScore,
          _count: { questions: questionsMap.get(q.id) || 0 },
          attempt: latestAttempt ? {
            id: latestAttempt.id,
            attemptNumber: latestAttempt.attemptNumber,
            score: latestAttempt.netScore,
            submittedAt: latestAttempt.submittedAt,
            status: latestAttempt.status,
          } : null,
        };
      });

      if (status) {
        if (status === 'locked') {
          result = result.filter(q => q.isLocked);
        } else if (status === 'available' || status === 'not_attempted') {
          result = result.filter(q => !q.isLocked && q.status === 'Not Attempted');
        } else if (status === 'in_progress') {
          result = result.filter(q => !q.isLocked && q.status === 'In Progress');
        } else if (status === 'completed') {
          result = result.filter(q => !q.isLocked && q.status === 'Completed');
        }
      }

      return NextResponse.json({
        quizzes: result,
        pagination: { page, limit, total: totalCount || 0, totalPages: Math.ceil((totalCount || 0) / limit) },
      });
    }

    // -------------------------------------------------------------
    // TEACHER / ADMIN PATH: Manage quizzes with course linkage info
    // -------------------------------------------------------------
    let query = supabase.from('Quiz').select('id', { count: 'exact' });

    if (payload?.role === 'teacher') {
      query = query.eq('createdBy', payload.sub);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status as 'draft' | 'published' | 'archived');
    }

    if (categoryId) {
      query = query.eq('categoryId', categoryId);
    }

    // If teacher filters by course
    if (courseIdFilter) {
      const { data: cqForCourse = [] } = await supabase
        .from('CourseQuiz')
        .select('quizId')
        .eq('courseId', courseIdFilter);
      const quizIdsForCourse = (cqForCourse || []).map((c: any) => c.quizId);
      if (quizIdsForCourse.length === 0) {
        return NextResponse.json({ quizzes: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
      query = query.in('id', quizIdsForCourse);
    }

    const { count: totalCount, error: countError } = await query;
    if (countError) throw countError;
    const countValue = totalCount || 0;

    let dataQuery = supabase.from('Quiz').select('*');
    if (payload?.role === 'teacher') {
      dataQuery = dataQuery.eq('createdBy', payload.sub);
    }
    if (search) {
      dataQuery = dataQuery.ilike('title', `%${search}%`);
    }
    if (status) {
      dataQuery = dataQuery.eq('status', status as 'draft' | 'published' | 'archived');
    }
    if (categoryId) {
      dataQuery = dataQuery.eq('categoryId', categoryId);
    }
    if (courseIdFilter) {
      const { data: cqForCourse = [] } = await supabase
        .from('CourseQuiz')
        .select('quizId')
        .eq('courseId', courseIdFilter);
      const quizIdsForCourse = (cqForCourse || []).map((c: any) => c.quizId);
      dataQuery = dataQuery.in('id', quizIdsForCourse);
    }

    const { data: dbQuizzes = [], error: dataError } = await dataQuery
      .order(orderColumn, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (dataError) throw dataError;

    const categoryIds = (dbQuizzes || []).map((q: any) => q.categoryId).filter(Boolean);
    const creatorIds = (dbQuizzes || []).map((q: any) => q.createdBy);
    const quizIds = (dbQuizzes || []).map((q: any) => q.id);

    const [categoriesResponse, creatorsResponse, questionsResponse, attemptsResponse, courseQuizzesResponse] = await Promise.all([
      categoryIds.length > 0 ? supabase.from('QuizCategory').select('*').in('id', categoryIds) : Promise.resolve({ data: [] }),
      creatorIds.length > 0 ? supabase.from('User').select('id, fullName').in('id', creatorIds) : Promise.resolve({ data: [] }),
      quizIds.length > 0 ? supabase.from('Question').select('quizId, id').in('quizId', quizIds) : Promise.resolve({ data: [] }),
      quizIds.length > 0 ? supabase.from('QuizAttempt').select('quizId, studentId').in('quizId', quizIds) : Promise.resolve({ data: [] }),
      quizIds.length > 0 ? supabase.from('CourseQuiz').select('quizId, courseId, curriculumNodeId').in('quizId', quizIds) : Promise.resolve({ data: [] }),
    ]);

    const categories = categoriesResponse.data || [];
    const creators = creatorsResponse.data || [];
    const questions = questionsResponse.data || [];
    const attempts = attemptsResponse.data || [];
    const courseQuizzes = courseQuizzesResponse.data || [];

    const linkedCourseIds = Array.from(new Set(courseQuizzes.map((cq: any) => cq.courseId).filter(Boolean)));
    const { data: linkedCourses = [] } = linkedCourseIds.length > 0
      ? await supabase.from('Course').select('id, title, slug').in('id', linkedCourseIds)
      : { data: [] };

    const linkedCourseMap = new Map((linkedCourses || []).map((c: any) => [c.id, c]));
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
    const creatorMap = new Map(creators.map((c: any) => [c.id, c]));

    const questionsMap = new Map<string, { id: string }[]>();
    for (const q of questions) {
      const list = questionsMap.get((q as any).quizId) || [];
      list.push({ id: (q as any).id });
      questionsMap.set((q as any).quizId, list);
    }

    const attemptsCountMap = new Map<string, number>();
    const uniqueUsersMap = new Map<string, Set<string>>();

    for (const a of attempts) {
      const qId = (a as any).quizId;
      const sId = (a as any).studentId;
      attemptsCountMap.set(qId, (attemptsCountMap.get(qId) || 0) + 1);

      if (!uniqueUsersMap.has(qId)) {
        uniqueUsersMap.set(qId, new Set<string>());
      }
      if (sId) {
        uniqueUsersMap.get(qId)!.add(sId);
      }
    }

    const quizzes = (dbQuizzes || []).map((q: any) => {
      const cq = courseQuizzes.find((c: any) => c.quizId === q.id);
      const linkedCourse = cq ? linkedCourseMap.get(cq.courseId) : null;

      return {
        ...q,
        courseId: cq?.courseId || null,
        courseName: linkedCourse?.title || null,
        courseSlug: linkedCourse?.slug || null,
        curriculumNodeId: cq?.curriculumNodeId || null,
        category: q.categoryId ? categoryMap.get(q.categoryId) || null : null,
        creator: creatorMap.get(q.createdBy) || null,
        questions: questionsMap.get(q.id) || [],
        _count: { questions: (questionsMap.get(q.id) || []).length },
        attemptsCount: attemptsCountMap.get(q.id) || 0,
        uniqueUsersCount: uniqueUsersMap.get(q.id)?.size || 0,
      };
    });

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
      sbaMarks,
      sbaNegative,
      tfMarks,
      tfNegative,
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
      positionType: (positionType || 'best_attempt') as 'best_attempt' | 'last_attempt' | 'first_attempt' | 'average_attempt',
      allowMultipleAttempts: allowMultipleAttempts || false,
      maxAttempts: maxAttempts || null,
      allowNegativeMarking: allowNegativeMarking || false,
      negativeValue: negativeValue !== undefined ? negativeValue : 20,
      marksPerCorrect: marksPerCorrect || 1,
      sbaMarks: sbaMarks !== undefined ? sbaMarks : 1,
      sbaNegative: sbaNegative !== undefined ? sbaNegative : 0,
      tfMarks: tfMarks !== undefined ? tfMarks : 1,
      tfNegative: tfNegative !== undefined ? tfNegative : 0,
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
        questionType: q.questionType,
        optionA: q.optionA.trim(),
        optionB: q.optionB.trim(),
        optionC: q.optionC?.trim() || null,
        optionD: q.optionD?.trim() || null,
        optionE: q.optionE?.trim() || null,
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