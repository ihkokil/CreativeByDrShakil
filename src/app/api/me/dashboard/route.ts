import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inArray, and, eq, desc, asc } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes } from '@/lib/media-vault-populator';
import { parseDbDate } from '@/lib/date-format';
import { 
  user as userSchema, 
  order as orderSchema, 
  course as courseSchema, 
  payment as paymentSchema, 
  lessonProgress as lessonProgressSchema, 
  quiz as quizSchema, 
  quizAttempt as quizAttemptSchema 
} from '@/db/schema';

export const dynamic = 'force-dynamic';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const users = await db.select({
      id: userSchema.id,
      email: userSchema.email,
      phone: userSchema.phone,
      role: userSchema.role,
      fullName: userSchema.fullName,
      profileImage: userSchema.profileImage,
      bmdcNumber: userSchema.bmdcNumber,
      designation: userSchema.designation,
      institution: userSchema.institution,
      degrees: userSchema.degrees,
      createdAt: userSchema.createdAt,
    })
    .from(userSchema)
    .where(eq(userSchema.id, payload.sub))
    .limit(1);

    const user = users[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS);

    const rawOrders = await db.select()
      .from(orderSchema)
      .where(eq(orderSchema.userId, user.id))
      .orderBy(desc(orderSchema.createdAt));

    const orderCourseIds = rawOrders.map(o => o.courseId);
    const orderIds = rawOrders.map(o => o.id);

    const [coursesList, paymentsList] = await Promise.all([
      orderCourseIds.length > 0
        ? db.select({
            id: courseSchema.id,
            slug: courseSchema.slug,
            title: courseSchema.title,
            imageUrl: courseSchema.imageUrl,
            duration: courseSchema.duration,
            status: courseSchema.status,
            curriculumJson: courseSchema.curriculumJson,
          })
          .from(courseSchema)
          .where(inArray(courseSchema.id, orderCourseIds))
        : Promise.resolve([]),
      orderIds.length > 0
        ? db.select({
            id: paymentSchema.id,
            orderId: paymentSchema.orderId,
            status: paymentSchema.status,
            transactionId: paymentSchema.transactionId,
            phoneNumber: paymentSchema.phoneNumber,
            submittedAt: paymentSchema.submittedAt,
            approvedAt: paymentSchema.approvedAt,
          })
          .from(paymentSchema)
          .where(inArray(paymentSchema.orderId, orderIds))
        : Promise.resolve([]),
    ]);

    const coursesMap = new Map(coursesList.map(c => [c.id, c]));
    const paymentsMap = new Map<string, any[]>();
    paymentsList.forEach(p => {
      const list = paymentsMap.get(p.orderId) || [];
      list.push(p);
      paymentsMap.set(p.orderId, list);
    });

    const orders = rawOrders.map(o => ({
      ...o,
      course: coursesMap.get(o.courseId) || null,
      payments: paymentsMap.get(o.id) || [],
    }));

    let enrolledCourses: any[] = [];
    
    if (isAdmin) {
      const allPublishedCourses = await db.select()
        .from(courseSchema)
        .where(eq(courseSchema.status, 'published'));

      enrolledCourses = await Promise.all(allPublishedCourses.map(async (course: any) => {
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
    const progressRows = courseIds.length
      ? await db.select({
          courseId: lessonProgressSchema.courseId,
          lessonNodeId: lessonProgressSchema.lessonNodeId,
        })
        .from(lessonProgressSchema)
        .where(and(
          eq(lessonProgressSchema.userId, user.id),
          inArray(lessonProgressSchema.courseId, courseIds)
        ))
      : [];

    const progressByCourse = progressRows.reduce<Record<string, Set<string>>>((acc: any, row: any) => {
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
    const publishedQuizzes = await db.select({
      id: quizSchema.id,
      title: quizSchema.title,
    })
    .from(quizSchema)
    .where(eq(quizSchema.status, 'published'));

    const rawAttempts = await db.select()
      .from(quizAttemptSchema)
      .where(eq(quizAttemptSchema.studentId, user.id))
      .orderBy(desc(quizAttemptSchema.submittedAt));

    const attemptQuizIds = Array.from(new Set(rawAttempts.map(a => a.quizId)));

    const quizzesList = attemptQuizIds.length > 0
      ? await db.select({
          id: quizSchema.id,
          title: quizSchema.title,
        })
        .from(quizSchema)
        .where(inArray(quizSchema.id, attemptQuizIds))
      : [];

    const quizzesMap = new Map(quizzesList.map(q => [q.id, q]));

    const studentAttempts = rawAttempts.map(a => ({
      ...a,
      quiz: quizzesMap.get(a.quizId) || null,
    }));

    const completedAttempts = studentAttempts.filter(a => a.status === 'submitted' || a.status === 'auto_submitted');
    const completedQuizIds = new Set(completedAttempts.map(a => a.quizId));
    const completedCount = completedQuizIds.size;
    const availableCount = publishedQuizzes.filter(q => !completedQuizIds.has(q.id)).length;
    const averageScore = completedAttempts.length > 0 
      ? Math.round(completedAttempts.reduce((sum, a) => sum + a.percentageScore, 0) / completedAttempts.length)
      : 0;

    const recentQuizAttempts = completedAttempts.slice(0, 3).map(a => ({
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
        id: order.course.id,
        title: order.course.title,
        slug: order.course.slug,
      },
      payment: order.payments?.[0] ?? null,
    }));

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        fullName: user.fullName,
        profileImage: user.profileImage,
        bmdcNumber: user.bmdcNumber,
        designation: user.designation,
        institution: user.institution,
        degrees: user.degrees,
        createdAt: user.createdAt,
      },
      studyStats,
      enrolledCourses,
      purchaseHistory,
      quizStats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
