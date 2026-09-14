import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { parseCurriculumJson, countLessons } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get all courses (sorted by latest modification)
    const { data: rawCourses } = await supabase
      .from('Course')
      .select('id, title, status, price, createdAt, updatedAt, curriculumJson')
      .order('updatedAt', { ascending: false });
      
    const courses = rawCourses || [];

    const courseIds = courses.map((c: any) => c.id);

    // Get all approved orders
    const ordersPromise = courseIds.length > 0
      ? supabase.from('Order').select('id, courseId, totalAmount, status, createdAt').eq('status', 'approved').in('courseId', courseIds)
      : Promise.resolve({ data: [] as any[] });

    // Get pending orders
    const pendingPromise = courseIds.length > 0
      ? supabase.from('Order').select('id', { count: 'exact', head: true }).eq('status', 'pending').in('courseId', courseIds)
      : Promise.resolve({ data: null, count: 0 });

    // Get total students
    const studentsPromise = supabase
      .from('User')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'student');

    const [ordersRes, pendingRes, studentsRes] = await Promise.all([ordersPromise, pendingPromise, studentsPromise]);

    const approvedOrders = ordersRes.data || [];
    const pendingCount = pendingRes.count || 0;
    const totalStudents = studentsRes.count || 0;

    const totalRevenue = approvedOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const totalEnrollments = approvedOrders.length;
    const publishedCourses = (courses || []).filter((c: any) => c.status === 'published').length;

    // Get progress rows for all approved courses to calculate average progress
    const progressResponse = courseIds.length > 0 
      ? await supabase.from('LessonProgress').select('courseId, userId').in('courseId', courseIds)
      : { data: [] };
      
    const progressRows = progressResponse.data || [];

    // Per-course stats
    const enrollmentsByCourse: Record<string, number> = {};
    const revenueByCourse: Record<string, number> = {};
    const lastEnrollmentByCourse: Record<string, string> = {};
    for (const order of approvedOrders) {
      enrollmentsByCourse[order.courseId] = (enrollmentsByCourse[order.courseId] || 0) + 1;
      revenueByCourse[order.courseId] = (revenueByCourse[order.courseId] || 0) + (order.totalAmount || 0);
      if (order.createdAt) {
        if (!lastEnrollmentByCourse[order.courseId] || new Date(order.createdAt) > new Date(lastEnrollmentByCourse[order.courseId])) {
          lastEnrollmentByCourse[order.courseId] = order.createdAt;
        }
      }
    }

    const courseStats = (courses || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      enrollments: enrollmentsByCourse[c.id] || 0,
      revenue: revenueByCourse[c.id] || 0,
    }));

    // Pre-hydrate all curriculums
    const hydratedCourses = await Promise.all(
      (courses || []).map(async (c: any) => {
        let parsed: any[] = [];
        try {
          parsed = c.curriculumJson ? parseCurriculumJson(c.curriculumJson) : [];
        } catch (e) {}
        const hydrated = await populateMediaVaultNodes(parsed, supabase);
        return {
          ...c,
          hydratedCurriculum: hydrated
        };
      })
    );

    let totalPossibleLessonsForAll = 0;
    let totalCompletedLessonsForAll = 0;

    const courseProgress = courseStats.map(cs => {
      const course = hydratedCourses.find((c: any) => c.id === cs.id);
      const totalLessons = course ? countLessons(course.hydratedCurriculum) : 0;
      const maxPossibleCompleted = cs.enrollments * totalLessons;
      
      const actualCompleted = progressRows.filter((p: any) => p.courseId === cs.id).length;
      const avgProgress = maxPossibleCompleted > 0 ? Math.round((actualCompleted / maxPossibleCompleted) * 100) : 0;

      totalPossibleLessonsForAll += maxPossibleCompleted;
      totalCompletedLessonsForAll += actualCompleted;

      return {
        courseId: cs.id,
        courseTitle: cs.title,
        enrollmentCount: cs.enrollments,
        avgProgress,
        updatedAt: course?.updatedAt || course?.createdAt || null,
        lastEnrollmentAt: lastEnrollmentByCourse[cs.id] || null,
      };
    });

    // Prioritize active & enrolled courses first, then most recently modified
    courseProgress.sort((a, b) => {
      const aHasStudents = a.enrollmentCount > 0 ? 1 : 0;
      const bHasStudents = b.enrollmentCount > 0 ? 1 : 0;
      if (bHasStudents !== aHasStudents) {
        return bHasStudents - aHasStudents;
      }
      if (aHasStudents && bHasStudents) {
        const aEnroll = a.lastEnrollmentAt ? new Date(a.lastEnrollmentAt).getTime() : 0;
        const bEnroll = b.lastEnrollmentAt ? new Date(b.lastEnrollmentAt).getTime() : 0;
        if (bEnroll !== aEnroll) return bEnroll - aEnroll;
        if (b.enrollmentCount !== a.enrollmentCount) return b.enrollmentCount - a.enrollmentCount;
      }
      const aUpdate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUpdate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (bUpdate !== aUpdate) return bUpdate - aUpdate;
      return b.avgProgress - a.avgProgress;
    });

    const aggregateProgress = totalPossibleLessonsForAll > 0 
      ? Math.round((totalCompletedLessonsForAll / totalPossibleLessonsForAll) * 100)
      : 0;

    return NextResponse.json({
      totalCourses: (courses || []).length,
      publishedCourses,
      totalStudents,
      totalEnrollments,
      totalRevenue,
      pendingOrders: pendingCount,
      courseStats,
      courseProgress,
      aggregateProgress,
    });
  } catch (error: any) {
    console.error('[teacher/stats] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
