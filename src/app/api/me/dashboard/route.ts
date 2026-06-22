import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inArray, and, eq } from 'drizzle-orm';
import { getAuthPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';

export const dynamic = 'force-dynamic';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const user = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, payload.sub),
      columns: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
        profileImage: true,
        bmdcNumber: true,
        designation: true,
        institution: true,
        degrees: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin';
    const oneYearAgo = new Date(Date.now() - ONE_YEAR_MS);

    const orders = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.userId, user.id),
      with: {
        course: {
          columns: {
            id: true,
            slug: true,
            title: true,
            imageUrl: true,
            duration: true,
            status: true,
            curriculumJson: true,
          },
        },
        payments: {
          columns: {
            id: true,
            status: true,
            transactionId: true,
            phoneNumber: true,
            submittedAt: true,
            approvedAt: true,
          },
        },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
    });

    let enrolledCourses: any[] = [];
    
    if (isAdmin) {
      const allPublishedCourses = await db.query.course.findMany({
        where: (c, { eq }) => eq(c.status, 'published'),
      });

      enrolledCourses = allPublishedCourses.map((course: any) => {
        const curriculum = parseCurriculumJson(course.curriculumJson);
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
      });
    } else {
      const approvedOrders = orders.filter((order: any) => {
        if (order.status !== 'approved') return false;
        if (order.expiresAt) {
          return new Date(order.expiresAt) >= new Date();
        }
        return new Date(order.updatedAt) >= oneYearAgo;
      });
      enrolledCourses = approvedOrders.map((order: any) => {
        const curriculum = parseCurriculumJson(order.course.curriculumJson);
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
      });
    }

    const courseIds = enrolledCourses.map((c) => c.courseId);
    const progressRows = courseIds.length
      ? await db.query.lessonProgress.findMany({
          where: (lp, { eq, inArray, and }) => and(
            eq(lp.userId, user.id),
            inArray(lp.courseId, courseIds)
          ),
          columns: {
            courseId: true,
            lessonNodeId: true,
          },
        })
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
