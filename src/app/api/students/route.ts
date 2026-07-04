import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    const students = await db.user.findMany({
      where: { role: 'student' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        createdAt: true,
        profileImage: true,
        deviceSessions: {
          select: {
            id: true,
            deviceType: true,
            browserName: true,
            ipAddress: true,
            isLocked: true,
            loggedOutAt: true,
            createdAt: true,
            lastActivityAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        orders: {
          where: { status: 'approved' },
          select: {
            id: true,
            enrolledAt: true,
            expiresAt: true,
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formattedStudents = students.map((student) => {
      const activeSessions = student.deviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

      return {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        role: student.role,
        createdAt: student.createdAt,
        profileImage: student.profileImage,
        activeSessions,
        sessions: activeSessions, // compatibility
        enrolledCourses: student.orders.map((order) => ({
          orderId: order.id,
          courseId: order.course?.id,
          courseTitle: order.course?.title,
          courseSlug: order.course?.slug,
          enrolledAt: order.enrolledAt,
          expiresAt: order.expiresAt,
        })),
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

    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, slug: true },
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
        const student = await db.user.findFirst({
          where: { id: studentId, role: 'student' },
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
