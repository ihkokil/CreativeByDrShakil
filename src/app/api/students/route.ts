import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth-server';
import { ensureCourseEnrollment } from '@/lib/enrollment';

/**
 * GET /api/students - Returns a list of all student users, sessions, and courses.
 * POST /api/students - Batch enrolls multiple student IDs into a course.
 * Accessible by: Admin, Teacher
 */

export async function GET() {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const students = await db.query.users.findMany({
      where: eq(schema.users.role, 'student'),
      columns: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        profileImage: true,
      },
      orderBy: [desc(schema.users.createdAt)],
    });

    const studentIds = students.map(s => s.id);

    const [deviceSessions, orders] = await Promise.all([
      studentIds.length > 0
        ? db.query.deviceSessions.findMany({
            where: inArray(schema.deviceSessions.userId, studentIds),
            columns: {
              id: true,
              userId: true,
              deviceType: true,
              browserName: true,
              ipAddress: true,
              isLocked: true,
              loggedOutAt: true,
              createdAt: true,
              lastActivityAt: true,
            },
            orderBy: [desc(schema.deviceSessions.createdAt)],
          })
        : Promise.resolve([]),
      studentIds.length > 0
        ? db.query.orders.findMany({
            where: and(
              inArray(schema.orders.userId, studentIds),
              eq(schema.orders.status, 'approved')
            ),
            columns: {
              id: true,
              userId: true,
              courseId: true,
              enrolledAt: true,
              expiresAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const courseIds = [...new Set(orders.map(o => o.courseId).filter(Boolean))] as string[];

    const courses = courseIds.length > 0
      ? await db.query.courses.findMany({
          where: inArray(schema.courses.id, courseIds),
          columns: {
            id: true,
            title: true,
            slug: true,
          },
        })
      : [];

    const courseMap = new Map(courses.map(c => [c.id, c]));

    const deviceSessionsByUser = new Map<string, typeof deviceSessions>();
    for (const session of deviceSessions) {
      const list = deviceSessionsByUser.get(session.userId) || [];
      list.push(session);
      deviceSessionsByUser.set(session.userId, list);
    }

    const ordersByUser = new Map<string, typeof orders>();
    for (const order of orders) {
      const list = ordersByUser.get(order.userId) || [];
      list.push(order);
      ordersByUser.set(order.userId, list);
    }

    const formattedStudents = students.map((student) => {
      const userSessions = deviceSessionsByUser.get(student.id) || [];
      const activeSessions = userSessions.filter((s) => !s.loggedOutAt && !s.isLocked);
      const userOrders = ordersByUser.get(student.id) || [];

      return {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        role: student.role,
        createdAt: student.createdAt,
        profileImage: student.profileImage,
        activeSessions,
        sessions: activeSessions, // compatibility
        enrolledCourses: userOrders.map((order) => {
          const course = courseMap.get(order.courseId);
          return {
            orderId: order.id,
            courseId: course?.id,
            courseTitle: course?.title,
            courseSlug: course?.slug,
            enrolledAt: order.enrolledAt,
            expiresAt: order.expiresAt,
          };
        }),
      };
    });

    return NextResponse.json({ students: formattedStudents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { studentIds, courseId, enrolledAt: enrolledAtStr } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds array is required.' }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
      columns: { id: true, title: true, slug: true },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const enrolledAt = enrolledAtStr ? new Date(enrolledAtStr) : new Date();
    if (Number.isNaN(enrolledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid enrolledAt date provided.' }, { status: 400 });
    }
    const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    const enrolledStudents: string[] = [];
    const errors: string[] = [];

    for (const studentId of studentIds) {
      try {
        const student = await db.query.users.findFirst({
          where: and(eq(schema.users.id, studentId), eq(schema.users.role, 'student')),
        });

        if (!student) {
          errors.push(`Student with ID ${studentId} not found.`);
          continue;
        }

        // Enroll the student (handles basics bundle as well if needed)
        await ensureCourseEnrollment(
          db as any,
          student.id,
          course.id,
          course.title,
          course.slug,
          true, // enrolledByAdmin
          enrolledAt,
          expiresAt
        );

        enrolledStudents.push(student.fullName);
      } catch (err: any) {
        errors.push(`Failed to enroll student ${studentId}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enrolled ${enrolledStudents.length} student(s) successfully.`,
      enrolledStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
