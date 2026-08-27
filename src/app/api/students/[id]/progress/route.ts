import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, collectVideoNodes } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const courseId = request.nextUrl.searchParams.get('courseId');

    const supabase = getSupabaseAdmin();

    const { data: student }: { data: any } = await supabase
      .from('User')
      .select('id, fullName, email, phone, bmdcNumber, role, profileImage, createdAt')
      .eq('id', studentId)
      .limit(1)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    let orderQuery = supabase
      .from('Order')
      .select('id, courseId, batchId, enrolledAt, expiresAt, updatedAt, status')
      .eq('userId', studentId)
      .eq('status', 'approved');

    if (courseId) {
      orderQuery = orderQuery.eq('courseId', courseId);
    }

    const { data: orders = [] }: { data: any[] | null } = await orderQuery;
    const courseIds = [...new Set((orders || []).map((o: any) => o.courseId).filter(Boolean))];
    const batchIds = [...new Set((orders || []).map((o: any) => o.batchId).filter(Boolean))];

    if (courseIds.length === 0) {
      return NextResponse.json({
        student,
        courses: [],
        progress: {},
        avgProgress: 0,
      });
    }

    const [{ data: courses = [] }, { data: batches = [] }] = await Promise.all([
      supabase.from('Course').select('id, title, slug, imageUrl, curriculumJson').in('id', courseIds),
      batchIds.length > 0
        ? supabase.from('Batch').select('id, name, startDate').in('id', batchIds)
        : Promise.resolve({ data: [] }),
    ]);

    const batchMap = new Map<string, any>((batches || []).map((b: any) => [b.id, b]));

    // Get progress for all enrolled courses
    const { data: progressRows = [] } = await supabase
      .from('LessonProgress')
      .select('courseId, lessonNodeId, completedAt')
      .eq('userId', studentId)
      .in('courseId', courseIds);

    const progressByCourse = (progressRows || []).reduce<Record<string, Set<string>>>((acc, row: any) => {
      if (!acc[row.courseId]) acc[row.courseId] = new Set();
      acc[row.courseId].add(row.lessonNodeId);
      return acc;
    }, {});

    const enrichedCourses = await Promise.all((courses || []).map(async (course: any) => {
      const rawCurriculum = parseCurriculumJson(course.curriculumJson);
      const curriculum = await populateMediaVaultNodes(rawCurriculum);
      const lessonNodes = collectVideoNodes(curriculum);
      const completedIds = progressByCourse[course.id] || new Set<string>();
      const completedCount = lessonNodes.filter((n: any) => completedIds.has(n.id)).length;
      const totalCount = lessonNodes.length;

      const order = (orders || []).find((o: any) => o.courseId === course.id);
      const batch = order?.batchId ? batchMap.get(order.batchId) : null;

      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        orderId: order?.id || '',
        courseId: course.id,
        courseTitle: course.title,
        courseSlug: course.slug,
        imageUrl: course.imageUrl,
        enrolledAt: order?.enrolledAt || order?.updatedAt || null,
        expiresAt: order?.expiresAt || null,
        batchId: order?.batchId || null,
        batchName: batch?.name || null,
        batchStartDate: batch?.startDate || null,
        completedCount,
        totalCount,
        progressPercent,
      };
    }));

    const progressMap: Record<string, number> = {};
    enrichedCourses.forEach((c: any) => {
      progressMap[c.courseId] = c.progressPercent;
    });

    const avgProgress = enrichedCourses.length > 0
      ? Math.round(enrichedCourses.reduce((sum, c) => sum + c.progressPercent, 0) / enrichedCourses.length)
      : 0;

    return NextResponse.json({
      student,
      courses: enrichedCourses,
      progress: progressMap,
      avgProgress,
    });
  } catch (error: any) {
    console.error('[students/progress] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
