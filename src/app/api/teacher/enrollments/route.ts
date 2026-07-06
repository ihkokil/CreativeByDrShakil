import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';
import { requireTeacherPayload } from '@/lib/route-auth';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      courseId, 
      studentId, 
      isNewStudent,
      email, 
      fullName, 
      phone 
    } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required.' }, { status: 400 });
    }

    // Verify course belongs to this teacher
    const course = await db.query.courses.findFirst({
      where: and(eq(schema.courses.id, courseId), eq(schema.courses.teacherId, payload.sub)),
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found or unauthorized.' }, { status: 404 });
    }

    let student;
    let isNewRegistration = false;

    if (isNewStudent) {
      if (!email || !fullName) {
        return NextResponse.json({ error: 'Email and full name are required for new students.' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const existingUser = await db.query.users.findFirst({
        where: phone 
          ? or(eq(schema.users.email, normalizedEmail), eq(schema.users.phone, phone))
          : eq(schema.users.email, normalizedEmail)
      });

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); 
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

      const studentId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: studentId,
        email: normalizedEmail,
        fullName: fullName,
        phone: phone || null,
        passwordHash: sql`crypt(${tempPassword}, gen_salt('bf', 12))`,
        role: 'student',
        emailVerified: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: resetExpiry,
      });
      const newStudent = await db.query.users.findFirst({ where: eq(schema.users.id, studentId) });
      if (!newStudent) {
        return NextResponse.json({ error: 'Failed to create student.' }, { status: 500 });
      }
      student = newStudent;
      isNewRegistration = true;

      try {
        await sendPasswordSetupEmail({
          email: student.email,
          fullName: student.fullName,
          token: setupToken,
        });
      } catch (emailError) {
        console.error('Failed to send password setup email:', emailError);
      }
    } else {
      if (!studentId) {
        return NextResponse.json({ error: 'Student ID is required for existing students.' }, { status: 400 });
      }

      student = await db.query.users.findFirst({
        where: and(eq(schema.users.id, studentId), eq(schema.users.role, 'student')),
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    const existingOrder = await db.query.orders.findFirst({
      where: and(eq(schema.orders.userId, student.id), eq(schema.orders.courseId, courseId)),
    });

    if (existingOrder?.status === 'approved') {
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    let order;
    if (existingOrder) {
      await db.update(schema.orders)
        .set({
          status: 'approved',
          totalAmount: 0,
        })
        .where(eq(schema.orders.id, existingOrder.id));
      order = await db.query.orders.findFirst({ where: eq(schema.orders.id, existingOrder.id) });
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(schema.orders)
        .values({
          id: newOrderId,
          userId: student.id,
          courseId,
          status: 'approved',
          totalAmount: 0,
        });
      const newOrder = await db.query.orders.findFirst({ where: eq(schema.orders.id, newOrderId) });
      if (!newOrder) {
         return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
      }
      order = newOrder;
    }

    return NextResponse.json({
      success: true,
      message: isNewRegistration
        ? `Student enrolled successfully. A password setup email has been sent to ${student.email}.`
        : 'Student enrolled successfully.',
      enrollment: {
        id: order!.id,
        student: {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          phone: student.phone,
        },
        course: {
          id: course.id,
          title: course.title,
        },
        isNewRegistration,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// GET - List all enrollments for teacher courses
export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const rawEnrollments = await db.query.orders.findMany({
      where: eq(schema.orders.status, 'approved'),
      orderBy: [desc(schema.orders.createdAt)],
      limit: 100,
    });

    // Fetch related users and courses separately for MariaDB compatibility
    const userIds = [...new Set(rawEnrollments.map(e => e.userId))] as string[];
    const courseIds = [...new Set(rawEnrollments.map(e => e.courseId))] as string[];

    const [relatedUsers, relatedCourses] = await Promise.all([
      userIds.length > 0
        ? db.query.users.findMany({
            where: inArray(schema.users.id, userIds),
            columns: { id: true, fullName: true, email: true, phone: true },
          })
        : [],
      courseIds.length > 0
        ? db.query.courses.findMany({
            where: inArray(schema.courses.id, courseIds),
            columns: { id: true, title: true, slug: true, teacherId: true },
          })
        : [],
    ]);

    const userMap = new Map(relatedUsers.map(u => [u.id, u]));
    const courseMap = new Map(relatedCourses.map(c => [c.id, c]));

    const enrollments = rawEnrollments.map(e => ({
      ...e,
      user: userMap.get(e.userId) || null,
      course: courseMap.get(e.courseId) || null,
    }));

    // Filter to only include enrollments for courses this teacher owns or manages (if needed, but platform seems to give full access)
    // Actually, teacher has full view of students usually, but we'll just filter by teacherId if they are not admin.
    let teacherEnrollments = enrollments;
    if (payload.role !== 'admin') {
       teacherEnrollments = enrollments.filter(e => e.course?.teacherId === payload.sub);
    }

    return NextResponse.json({
      enrollments: teacherEnrollments.map((e) => ({
        id: e.id,
        student: e.user,
        course: e.course,
        createdAt: e.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// DELETE - Remove enrollment
export async function DELETE(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    // A teacher might only be allowed to delete enrollments for their own course
    const existingOrder = await db.query.orders.findFirst({
        where: eq(schema.orders.id, orderId),
    });
    
    if (!existingOrder) {
        return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }

    // Fetch course separately for MariaDB compatibility
    const orderCourse = await db.query.courses.findFirst({
        where: eq(schema.courses.id, existingOrder.courseId),
    });
    
    if (payload.role !== 'admin' && orderCourse?.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course.' }, { status: 403 });
    }

    await db.delete(schema.orders).where(eq(schema.orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
