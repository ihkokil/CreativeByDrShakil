import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';
import { unlinkCourseQuiz } from '@/lib/curriculum-cleanup';
import { syncQuizPlacementToMediaVault } from '@/lib/course-media-vault-sync';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: courseQuizzes = [], error: cqError } = await supabase
      .from('CourseQuiz')
      .select('id, courseId, quizId, curriculumNodeId, sortOrder, createdAt')
      .eq('courseId', courseId)
      .order('sortOrder', { ascending: true })
      .order('createdAt', { ascending: true });

    if (cqError) throw cqError;

    const quizIds = (courseQuizzes || []).map((cq: any) => cq.quizId);
    let quizzesMap = new Map<string, any>();
    let questionCountsMap = new Map<string, number>();

    if (quizIds.length > 0) {
      const [{ data: quizzes = [] }, { data: questions = [] }] = await Promise.all([
        supabase
          .from('Quiz')
          .select('id, title, description, durationMinutes, numQuestionsToServe, status, createdAt, publishedAt')
          .in('id', quizIds),
        supabase
          .from('Question')
          .select('id, quizId')
          .in('quizId', quizIds),
      ]);

      (quizzes || []).forEach((q: any) => {
        quizzesMap.set(q.id, q);
      });

      (questions || []).forEach((q: any) => {
        questionCountsMap.set(q.quizId, (questionCountsMap.get(q.quizId) || 0) + 1);
      });
    }

    const result = (courseQuizzes || []).map((cq: any) => {
      const q = quizzesMap.get(cq.quizId) || null;
      return {
        id: cq.id,
        courseId: cq.courseId,
        quizId: cq.quizId,
        curriculumNodeId: cq.curriculumNodeId,
        sortOrder: cq.sortOrder,
        createdAt: cq.createdAt,
        quiz: q
          ? {
              ...q,
              questionCount: questionCountsMap.get(cq.quizId) || 0,
            }
          : null,
      };
    });

    return NextResponse.json({ quizzes: result });
  } catch (error: any) {
    console.error('GET /api/teacher/courses/[courseId]/quizzes error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const body = await request.json();
    const { quizIds, curriculumNodeId } = body;

    if (!Array.isArray(quizIds) || quizIds.length === 0) {
      return NextResponse.json({ error: 'quizIds must be a non-empty array.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify course exists
    const { data: course } = await supabase
      .from('Course')
      .select('id, title')
      .eq('id', courseId)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check if any of these quizzes are already linked to a different course
    const { data: existingLinks = [] } = await supabase
      .from('CourseQuiz')
      .select('quizId, courseId')
      .in('quizId', quizIds);

    const conflicting = (existingLinks || []).filter((l: any) => l.courseId !== courseId);
    if (conflicting.length > 0) {
      return NextResponse.json(
        { error: 'One or more quizzes are already linked to another course. A quiz can only belong to one course.' },
        { status: 400 }
      );
    }

    const targetNodeId = curriculumNodeId && String(curriculumNodeId).trim().length > 0
      ? String(curriculumNodeId).trim()
      : null;

    const nowStr = new Date().toISOString();

    for (let i = 0; i < quizIds.length; i++) {
      const qId = quizIds[i];
      const existing = (existingLinks || []).find((l: any) => l.quizId === qId && l.courseId === courseId);

      if (existing) {
        // Update curriculumNodeId and updatedAt
        await supabase
          .from('CourseQuiz')
          .update({
            curriculumNodeId: targetNodeId,
            updatedAt: nowStr,
          } as any)
          .eq('quizId', qId);
      } else {
        // Insert new CourseQuiz record
        await supabase.from('CourseQuiz').insert({
          id: nanoid(),
          courseId,
          quizId: qId,
          curriculumNodeId: targetNodeId,
          sortOrder: i,
          createdAt: nowStr,
          updatedAt: nowStr,
        } as any);
      }
    }

    // Two-way sync: Synchronize quiz nodes with Media Vault
    try {
      await syncQuizPlacementToMediaVault(supabase, courseId, quizIds, targetNodeId);
    } catch (syncErr) {
      console.error('[quizzes/route] Error syncing to Media Vault:', syncErr);
    }

    return NextResponse.json({ success: true, count: quizIds.length });
  } catch (error: any) {
    console.error('POST /api/teacher/courses/[courseId]/quizzes error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get('quizId');

    if (!quizId) {
      return NextResponse.json({ error: 'quizId query parameter is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Cascade unlink quiz: deletes CourseQuiz, removes from Course.curriculumJson, removes from VideoLibraryNode, and cleans progress
    await unlinkCourseQuiz(supabase, courseId, quizId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/teacher/courses/[courseId]/quizzes error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
