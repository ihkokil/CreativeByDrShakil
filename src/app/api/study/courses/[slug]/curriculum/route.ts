import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';
import {
  annotateCurriculumAvailability,
  collectSecondChildGroups,
  computeReleaseGroupDates,
  ensureGroupInheritance,
  parseCurriculumJson,
  parseReleaseGroupDateMap,
} from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { slug } = await params;
    const supabase = getSupabaseAdmin();

    const { data: course, error: courseError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('*')
      .eq('slug', slug)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // For admin and teachers, show everything without restrictions
    const isAdmin = payload.role === 'admin' || payload.role === 'teacher';

    // Get the student's enrollment
    let enrolledAt: string | null = null;
    let studentBatch: any = null;

    if (!isAdmin) {
      const { data: order }: { data: any } = await supabase
        .from('Order')
        .select('enrolledAt, updatedAt, batchId')
        .eq('userId', payload.sub)
        .eq('courseId', course.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();

      if (!order) {
        return NextResponse.json({ error: 'You are not enrolled in this course.' }, { status: 403 });
      }
      const { data: user }: { data: any } = await supabase
        .from('User')
        .select('enrollmentDate, batchId')
        .eq('id', payload.sub)
        .limit(1)
        .maybeSingle();

      const targetBatchId = order.batchId || user?.batchId;
      if (targetBatchId) {
        const { data: batch }: { data: any } = await supabase
          .from('Batch')
          .select('id, name, startDate')
          .eq('id', targetBatchId)
          .limit(1)
          .maybeSingle();
        studentBatch = batch;
      }
      
      if (order.enrolledAt) {
        enrolledAt = order.enrolledAt;
      } else if (user?.enrollmentDate) {
        enrolledAt = user.enrollmentDate;
      } else {
        enrolledAt = order.updatedAt;
      }
    }

    const rawCurriculum = parseCurriculumJson(course.curriculumJson);

    // Fetch the "All Resources" folder from the Media Vault for this course
    const { data: rootFolder } = await supabase
      .from('VideoLibraryNode')
      .select('id')
      .is('parentId', null)
      .ilike('title', course.title)
      .limit(1)
      .maybeSingle();

    if (rootFolder) {
      const { data: allResFolder } = await supabase
        .from('VideoLibraryNode')
        .select('id')
        .eq('parentId', rootFolder.id)
        .ilike('title', 'all resources')
        .limit(1)
        .maybeSingle();

      if (allResFolder) {
        // Inject if not already present
        const hasIt = rawCurriculum.some((n: any) => String(n.title).trim().toLowerCase() === 'all resources');
        if (!hasIt) {
          rawCurriculum.unshift({
            id: 'all-resources-root',
            title: 'All Resources',
            type: 'folder',
            mediaVaultFolderId: allResFolder.id,
            children: []
          });
        }
      }
    }

    // Fetch course quizzes
    const { data: courseQuizzes = [] } = await supabase
      .from('CourseQuiz')
      .select('id, quizId, curriculumNodeId, sortOrder')
      .eq('courseId', course.id)
      .order('sortOrder', { ascending: true });

    const quizIds = (courseQuizzes || []).map((cq: any) => cq.quizId);
    let quizMap = new Map<string, any>();
    let completedQuizIds = new Set<string>();

    if (quizIds.length > 0) {
      const [{ data: quizData = [] }, { data: userAttempts = [] }] = await Promise.all([
        supabase
          .from('Quiz')
          .select('id, title, durationMinutes, numQuestionsToServe, status')
          .in('id', quizIds)
          .eq('status', 'published'),
        supabase
          .from('QuizAttempt')
          .select('quizId, status')
          .eq('studentId', payload.sub)
          .in('quizId', quizIds)
          .in('status', ['submitted', 'auto_submitted']),
      ]);

      (quizData || []).forEach((q: any) => quizMap.set(q.id, q));
      (userAttempts || []).forEach((a: any) => completedQuizIds.add(a.quizId));
    }

    // Attach module-level quizzes to raw curriculum
    const attachModuleQuizzes = (nodes: any[]): any[] => {
      return nodes.map(node => {
        const matchingQuizzes = (courseQuizzes || []).filter(
          (cq: any) => cq.curriculumNodeId && (cq.curriculumNodeId === node.id || (node.mediaVaultFolderId && cq.curriculumNodeId === node.mediaVaultFolderId)) && quizMap.has(cq.quizId)
        );

        let updatedChildren = node.children ? attachModuleQuizzes(node.children) : [];

        if (matchingQuizzes.length > 0) {
          const quizNodes = matchingQuizzes.map((cq: any) => {
            const q = quizMap.get(cq.quizId);
            return {
              id: `quiz_${cq.id}`,
              title: q.title,
              type: 'quiz',
              quizId: q.id,
              duration: q.durationMinutes ? `${q.durationMinutes} min` : undefined,
              completed: completedQuizIds.has(q.id),
              children: [],
            };
          });

          // Avoid duplicates if already attached
          const existingQuizIds = new Set(updatedChildren.filter((c: any) => c.type === 'quiz').map((c: any) => c.quizId));
          const newQuizNodes = quizNodes.filter((qn: any) => !existingQuizIds.has(qn.quizId));
          updatedChildren = [...updatedChildren, ...newQuizNodes];
        }

        return {
          ...node,
          children: updatedChildren.length > 0 ? updatedChildren : (node.children || []),
        };
      });
    };

    const populatedCurriculum = await populateMediaVaultNodes(rawCurriculum);
    const curriculumWithModuleQuizzes = attachModuleQuizzes(populatedCurriculum);
    const curriculum = ensureGroupInheritance(curriculumWithModuleQuizzes);
    const groups = collectSecondChildGroups(curriculum);
    const releaseGroupDates = parseReleaseGroupDateMap(course.releaseGroupDates);

    // Compute release dates
    let effectiveReleaseMode = course.releaseMode || 'custom_batch';
    let releaseStart = isAdmin 
      ? (course.releaseStartAt || course.courseStartDate || null)
      : (enrolledAt || course.releaseStartAt || course.courseStartDate || new Date().toISOString());

    if (!isAdmin && studentBatch) {
      const bName = (studentBatch.name || '').toLowerCase();
      if (bName.includes('instant') || bName.includes('all unlocked')) {
        effectiveReleaseMode = 'instant';
      } else if (bName.includes('custom') || bName.includes('start today')) {
        effectiveReleaseMode = 'custom_batch';
        releaseStart = enrolledAt || new Date().toISOString();
      } else if (studentBatch.startDate) {
        effectiveReleaseMode = course.releaseMode || 'circular';
        releaseStart = studentBatch.startDate;
      }
    }

    let releaseDaysOfWeek: number[] | null = null;
    if (course.releaseDaysOfWeek) {
      if (typeof course.releaseDaysOfWeek === 'string') {
        try {
          releaseDaysOfWeek = JSON.parse(course.releaseDaysOfWeek);
        } catch {
          releaseDaysOfWeek = null;
        }
      } else if (Array.isArray(course.releaseDaysOfWeek)) {
        releaseDaysOfWeek = course.releaseDaysOfWeek;
      }
    }

    const computedReleaseGroupDates = computeReleaseGroupDates(groups, {
      releaseMode: effectiveReleaseMode,
      releaseStartAt: releaseStart,
      releaseIntervalDays: course.releaseIntervalDays,
      releaseGroupsPerWeek: course.releaseGroupsPerWeek,
      releaseDaysOfWeek,
      releaseGroupDates,
    });

    // Fetch student-specific overrides
    let overrides: any[] = [];
    if (!isAdmin) {
      const { data: overrideRows = [] } = await supabase
        .from('StudentModuleAvailability')
        .select('lessonNodeId, availabilityMode, availableAt')
        .eq('courseId', course.id)
        .eq('userId', payload.sub);

      overrides = (overrideRows || []).map((row: any) => ({
        lessonNodeId: row.lessonNodeId,
        availabilityMode: row.availabilityMode,
        availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      }));
    }

    const annotatedCurriculum = annotateCurriculumAvailability(
      curriculum,
      computedReleaseGroupDates,
      new Date(),
      overrides
    );

    // Get progress
    const { data: progressRows = [] } = await supabase
      .from('LessonProgress')
      .select('lessonNodeId')
      .eq('userId', payload.sub)
      .eq('courseId', course.id);

    const completedIds = new Set((progressRows || []).map((r: any) => r.lessonNodeId));

    // Mark completed nodes
    const markCompleted = (nodes: any[]): any[] =>
      nodes.map(node => ({
        ...node,
        completed: node.type === 'quiz' ? (completedQuizIds.has(node.quizId) || completedIds.has(node.id)) : completedIds.has(node.id),
        children: node.children ? markCompleted(node.children) : undefined,
      }));

    const processedCurriculum = markCompleted(annotatedCurriculum);

    // Build "All Quizzes" virtual folder:
    // 1. Quizzes explicitly assigned to "All Quizzes" (curriculumNodeId is null/empty)
    // 2. Plus any module-assigned quizzes that are currently unlocked
    const globalCourseQuizzes = (courseQuizzes || []).filter(
      (cq: any) => (!cq.curriculumNodeId || cq.curriculumNodeId === '') && quizMap.has(cq.quizId)
    );

    const allQuizzesItems: any[] = globalCourseQuizzes.map((cq: any) => {
      const q = quizMap.get(cq.quizId);
      return {
        id: `quiz_${cq.id}`,
        title: q.title,
        type: 'quiz',
        quizId: q.id,
        duration: q.durationMinutes ? `${q.durationMinutes} min` : undefined,
        locked: false,
        availableAt: null,
        completed: completedQuizIds.has(q.id),
      };
    });

    // Traverse processedCurriculum to collect unlocked module quizzes
    const collectUnlockedQuizzes = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === 'quiz' && !node.locked) {
          if (!allQuizzesItems.some((item: any) => item.quizId === node.quizId)) {
            allQuizzesItems.push({
              ...node,
              locked: false,
              availableAt: null,
            });
          }
        }
        if (node.children && Array.isArray(node.children)) {
          collectUnlockedQuizzes(node.children);
        }
      }
    };
    collectUnlockedQuizzes(processedCurriculum);

    // Process "All Resources" folder positioning and visibility
    const allResourcesNode = processedCurriculum.find((n: any) => String(n.title).trim().toLowerCase() === 'all resources');
    const otherNodes = processedCurriculum.filter((n: any) => {
      const titleLower = String(n.title).trim().toLowerCase();
      return titleLower !== 'all resources' && titleLower !== 'all quizzes' && titleLower !== 'all quizes';
    });

    let topVirtualNodes: any[] = [];
    if (allResourcesNode) {
      const hasDocs = Array.isArray(allResourcesNode.children) && allResourcesNode.children.length > 0;
      if (hasDocs) {
        allResourcesNode.locked = false;
        allResourcesNode.availableAt = null;
        topVirtualNodes.push(allResourcesNode);
      }
    }

    if (allQuizzesItems.length > 0) {
      topVirtualNodes.push({
        id: 'all-quizzes-root',
        title: 'All Quizzes',
        type: 'folder',
        locked: false,
        availableAt: null,
        children: allQuizzesItems,
      });
    }

    const finalCurriculum = [...topVirtualNodes, ...otherNodes];

    return NextResponse.json({
      courseId: course.id,
      course: {
        title: course.title,
      },
      enrollmentDate: enrolledAt,
      curriculum: finalCurriculum,
    });
  } catch (error: any) {
    console.error('[study/curriculum] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
