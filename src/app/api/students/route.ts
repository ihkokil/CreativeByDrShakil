import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { eq, inArray, and, desc } from 'drizzle-orm';
import { 
  user as userSchema, 
  deviceSession as deviceSessionSchema, 
  order as orderSchema, 
  course as courseSchema 
} from '@/db/schema';

/**
 * GET /api/students - Returns a list of all student users, sessions, and courses.
 * POST /api/students - Batch enrolls multiple student IDs into a course.
 * Accessible by: Admin, Teacher
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const studentsList = await db.select({
      id: userSchema.id,
      fullName: userSchema.fullName,
      email: userSchema.email,
      phone: userSchema.phone,
      bmdcNumber: userSchema.bmdcNumber,
      role: userSchema.role,
      createdAt: userSchema.createdAt,
      profileImage: userSchema.profileImage,
    })
    .from(userSchema)
    .where(eq(userSchema.role, 'student'))
    .orderBy(desc(userSchema.createdAt));

    const studentIds = studentsList.map(s => s.id);

    const [deviceSessionsList, ordersList] = await Promise.all([
      studentIds.length > 0
        ? db.select({
            id: deviceSessionSchema.id,
            userId: deviceSessionSchema.userId,
            deviceType: deviceSessionSchema.deviceType,
            browserName: deviceSessionSchema.browserName,
            ipAddress: deviceSessionSchema.ipAddress,
            isLocked: deviceSessionSchema.isLocked,
            loggedOutAt: deviceSessionSchema.loggedOutAt,
            createdAt: deviceSessionSchema.createdAt,
            lastActivityAt: deviceSessionSchema.lastActivityAt,
          })
          .from(deviceSessionSchema)
          .where(inArray(deviceSessionSchema.userId, studentIds))
          .orderBy(desc(deviceSessionSchema.createdAt))
        : Promise.resolve([]),
      studentIds.length > 0
        ? db.select({
            id: orderSchema.id,
            userId: orderSchema.userId,
            enrolledAt: orderSchema.enrolledAt,
            expiresAt: orderSchema.expiresAt,
            courseId: courseSchema.id,
            courseTitle: courseSchema.title,
            courseSlug: courseSchema.slug,
          })
          .from(orderSchema)
          .leftJoin(courseSchema, eq(orderSchema.courseId, courseSchema.id))
          .where(and(
            inArray(orderSchema.userId, studentIds),
            eq(orderSchema.status, 'approved')
          ))
        : Promise.resolve([]),
    ]);

    const deviceSessionsMap = new Map<string, any[]>();
    deviceSessionsList.forEach(ds => {
      const list = deviceSessionsMap.get(ds.userId) || [];
      list.push(ds);
      deviceSessionsMap.set(ds.userId, list);
    });

    const ordersMap = new Map<string, any[]>();
    ordersList.forEach(o => {
      if (o.courseId) {
        const list = ordersMap.get(o.userId) || [];
        list.push({
          id: o.id,
          enrolledAt: o.enrolledAt,
          expiresAt: o.expiresAt,
          course: {
            id: o.courseId,
            title: o.courseTitle,
            slug: o.courseSlug,
          },
        });
        ordersMap.set(o.userId, list);
      }
    });


    const students = studentsList.map(s => ({
      ...s,
      deviceSessions: deviceSessionsMap.get(s.id) || [],
      orders: ordersMap.get(s.id) || [],
    }));

    const formattedStudents = students.map((student) => {
      const activeSessions = student.deviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

      return {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        bmdcNumber: student.bmdcNumber,
        role: student.role,
        createdAt: student.createdAt,
        profileImage: student.profileImage,
        activeSessions,
        sessions: activeSessions, // compatibility
        enrolledCourses: student.orders.map((order) => ({
          orderId: order.id,
          courseId: order.course.id,
          courseTitle: order.course.title,
          courseSlug: order.course.slug,
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

    const coursesListResult = await db.select({
      id: courseSchema.id,
      title: courseSchema.title,
      slug: courseSchema.slug,
    })
    .from(courseSchema)
    .where(eq(courseSchema.id, courseId))
    .limit(1);

    const course = coursesListResult[0];

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

    // Transactions are not supported in neon-http driver, so we use standard sequential execution
    for (const studentId of studentIds) {
      try {
        const studentsListResult = await db.select()
          .from(userSchema)
          .where(and(eq(userSchema.id, studentId), eq(userSchema.role, 'student')))
          .limit(1);

        const student = studentsListResult[0];

        if (!student) {
          errors.push(`Student with ID ${studentId} not found.`);
          continue;
        }

        // Enroll the student (handles basics bundle as well if needed)
        await ensureCourseEnrollment(
          db,
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
