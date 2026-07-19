import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { extractCookieToken } from '@/lib/auth-server';
import { getAuthPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { parseDbDate } from '@/lib/date-format';
import { scopedToUser, scopedToStudent } from '@/lib/db-helpers';

export const dynamic = 'force-dynamic';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, email, phone, role, fullName, profileImage, bmdcNumber, designation, institution, degrees, createdAt')
      .eq('id', payload.sub)
      .limit(1)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isAdmin = (user as any).role === 'admin';
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS);

    const { data: rawOrders = [] } = await scopedToUser(
      supabase.from('Order').select('*'),
      (user as any).id
    ).order('createdAt', { ascending: false });

    const orderCourseIds = (rawOrders || []).map((o: any) => o.courseId);
    const orderIds = (rawOrders || []).map((o: any) => o.id);

    const coursesPromise = orderCourseIds.length > 0
      ? supabase.from('Course').select('id, slug, title, imageUrl, duration, status, curriculumJson').in('id', orderCourseIds)
      : Promise.resolve({ data: [] });
      
    const paymentsPromise = orderIds.length > 0
      ? supabase.from('Payment').select('id, orderId, status, transactionId, phoneNumber, submittedAt, approvedAt').in('orderId', orderIds)
      : Promise.resolve({ data: [] });

    const [coursesRes, paymentsRes] = await Promise.all([coursesPromise, paymentsPromise]);
    const coursesList = coursesRes.data || [];
    const paymentsList = paymentsRes.data || [];

    const coursesMap = new Map(coursesList.map((c: any) => [c.id, c]));
    const paymentsMap = new Map<string, any[]>();
    paymentsList.forEach((p: any) => {
      const list = paymentsMap.get(p.orderId) || [];
      list.push(p);
      paymentsMap.set(p.orderId, list);
    });

    const orders = (rawOrders || []).map((o: any) => ({
      ...o,
      course: coursesMap.get(o.courseId) || null,
      payments: paymentsMap.get(o.id) || [],
    }));

    let enrolledCourses: any[] = [];
    
    if (isAdmin) {
      const { data: allPublishedCourses = [] } = await supabase
        .from('Course')
        .select('*')
        .eq('status', 'published');

      enrolledCourses = await Promise.all((allPublishedCourses || []).map(async (course: any) => {
        const rawCurriculum = parseCurriculumJson(course.curriculumJson);
        const curriculum = await populateMediaVaultNodes(rawCurriculum);
        const lessonNodes = collectVideoNodes(curriculum);
        return {
          orderId: `admin-${course.id}`,
          courseId: course.id,
          courseSlug: course.slug,
          courseTitle: course.title,
          imageUrl: course.imageUrl,
          duration: course.duration,
          enrolledAt: course.createdAt,
          lessonNodes // Store for progress calculation
        };
      }));
    } else {
      const approvedOrders = orders.filter((order: any) => {
        if (order.status !== 'approved') return false;
        if (order.expiresAt) {
          const parsedExpiry = parseDbDate(order.expiresAt);
          return parsedExpiry ? parsedExpiry >= new Date() : false;
        }
        return new Date(order.updatedAt) >= oneYearAgo;
      });
      enrolledCourses = await Promise.all(approvedOrders.map(async (order: any) => {
        const rawCurriculum = parseCurriculumJson(order.course.curriculumJson);
        const curriculum = await populateMediaVaultNodes(rawCurriculum);
        const lessonNodes = collectVideoNodes(curriculum);
        return {
          orderId: order.id,
          courseId: order.course.id,
          courseSlug: order.course.slug,
          courseTitle: order.course.title,
          imageUrl: order.course.imageUrl,
          duration: order.course.duration,
          enrolledAt: order.enrolledAt || order.updatedAt,
          lessonNodes
        };
      }));
    }

    const courseIds = enrolledCourses.map((c) => c.courseId);
    
    const progressRes = courseIds.length
      ? await scopedToUser(
          supabase.from('LessonProgress').select('courseId, lessonNodeId'),
          (user as any).id
        ).in('courseId', courseIds)
      : { data: [] };
    const progressRows = progressRes.data || [];

    const progressByCourse = (progressRows as any[]).reduce((acc: Record<string, Set<string>>, row: any) => {
      if (!acc[row.courseId]) {
        acc[row.courseId] = new Set<string>();
      }
      acc[row.courseId].add(row.lessonNodeId);
      return acc;
    }, {});

    enrolledCourses = enrolledCourses.map((item) => {
      const completedIds = progressByCourse[item.courseId] || new Set<string>();
      const completedCount = item.lessonNodes.filter((node: any) => completedIds.has(node.id)).length;
      const totalCount = item.lessonNodes.length;
      const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        orderId: item.orderId,
        courseId: item.courseId,
        courseSlug: item.courseSlug,
        courseTitle: item.courseTitle,
        imageUrl: item.imageUrl,
        duration: item.duration,
        enrolledAt: item.enrolledAt,
        progress: {
          completedCount,
          totalCount,
          percentage: progressPercent,
        },
      };
    });

    const studyStats = {
      activeCourses: enrolledCourses.length,
      completedLessons: progressRows.length,
      averageProgress:
        enrolledCourses.length > 0
          ? Math.round(
              enrolledCourses.reduce((sum, course) => sum + course.progress.percentage, 0) /
                enrolledCourses.length
            )
          : 0,
      totalPurchases: orders.length,
    };

    // Quiz Stats
    const { data: publishedQuizzes = [] } = await supabase
      .from('Quiz')
      .select('id, title')
      .eq('status', 'published');

    const { data: rawAttempts = [] } = await scopedToStudent(
      supabase.from('QuizAttempt').select('*'),
      (user as any).id
    ).order('submittedAt', { ascending: false });

    const attemptQuizIds = Array.from(new Set<string>((rawAttempts as any[] || []).map((a: any) => a.quizId)));

    const quizzesRes = attemptQuizIds.length > 0
      ? await supabase.from('Quiz').select('id, title').in('id', attemptQuizIds)
      : { data: [] };
    const quizzesList = quizzesRes.data || [];

    const quizzesMap = new Map(quizzesList.map((q: any) => [q.id, q]));

    const studentAttempts = (rawAttempts || []).map((a: any) => ({
      ...a,
      quiz: quizzesMap.get(a.quizId) || null,
    }));

    const completedAttempts = studentAttempts.filter((a: any) => a.status === 'submitted' || a.status === 'auto_submitted');
    const completedQuizIds = new Set(completedAttempts.map((a: any) => a.quizId));
    const completedCount = completedQuizIds.size;
    const availableCount = (publishedQuizzes || []).filter((q: any) => !completedQuizIds.has(q.id)).length;
    const averageScore = completedAttempts.length > 0 
      ? Math.round(completedAttempts.reduce((sum: number, a: any) => sum + a.percentageScore, 0) / completedAttempts.length)
      : 0;

    const recentQuizAttempts = completedAttempts.slice(0, 3).map((a: any) => ({
      id: a.id,
      quizId: a.quizId,
      quizTitle: a.quiz?.title || 'Unknown Quiz',
      percentageScore: a.percentageScore,
      netScore: a.netScore,
      submittedAt: a.submittedAt,
    }));

    const quizStats = {
      availableCount,
      completedCount,
      averageScore,
      recentAttempts: recentQuizAttempts,
    };

    const purchaseHistory = orders.map((order: any) => ({
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      course: {
        id: order.course?.id,
        title: order.course?.title,
        slug: order.course?.slug,
      },
      payment: order.payments?.[0] ?? null,
    }));

    return NextResponse.json({
      profile: user,
      studyStats,
      enrolledCourses,
      purchaseHistory,
      quizStats,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
