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
      .select('id, fullName, email, profileImage')
      .eq('id', studentId)
      .limit(1)
      .maybeSingle();

    if (!student) {
      return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
    }

    let orderQuery = supabase
      .from('Order')
      .select('courseId, enrolledAt, updatedAt')
      .eq('userId', studentId)
      .eq('status', 'approved');

    if (courseId) {
      orderQuery = orderQuery.eq('courseId', courseId);
    }

    const { data: orders = [] }: { data: any[] | null } = await orderQuery;
    const courseIds = [...new Set((orders || []).map((o: any) => o.courseId).filter(Boolean))];

    if (courseIds.length === 0) {
      return NextResponse.json({
        student,
        courses: [],
      });
    }

    const { data: courses = [] } = await supabase
      .from('Course')
      .select('id, title, slug, imageUrl, curriculumJson')
      .in('id', courseIds);

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

      return {
        courseId: course.id,
        title: course.title,
        slug: course.slug,
        imageUrl: course.imageUrl,
        enrolledAt: order?.enrolledAt || order?.updatedAt,
        completedCount,
        totalCount,
        progressPercent: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      };
    }));

    return NextResponse.json({
      student,
      courses: enrichedCourses,
    });
  } catch (error: any) {
    console.error('[students/progress] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
