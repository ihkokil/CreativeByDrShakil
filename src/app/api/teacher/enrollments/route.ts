import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema, user as userSchema, order as orderSchema } from '@/db/schema';
import { eq, or, and, sql, asc, desc, inArray } from 'drizzle-orm';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';
import { requireTeacherPayload } from '@/lib/route-auth';


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
    const [course] = await db.select().from(courseSchema).where(and(eq(courseSchema.id, courseId), eq(courseSchema.teacherId, payload.sub))).limit(1);

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

      const [existingUser] = await db.select().from(userSchema).where(phone ? or(eq(userSchema.email, normalizedEmail), eq(userSchema.phone, phone)) : eq(userSchema.email, normalizedEmail)).limit(1);

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }



      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); 

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

      const { hash } = await import('bcryptjs');
      const studentId = crypto.randomUUID();
      const hashedPassword = await hash(tempPassword, 12);
      const nowStr = new Date().toISOString();

      const insertValues = {
          id: studentId,
          email: normalizedEmail,
          fullName,
          phone: phone || null,
          passwordHash: hashedPassword,
          role: 'student' as const,
          emailVerified: true,
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
      };

      await db.insert(userSchema).values(insertValues);

      const newStudent = {
          ...insertValues,
          createdAt: nowStr,
          updatedAt: nowStr,
          canManagePayments: false,
          isBanned: false,
          telegramChatId: null,
          image: null,
          isSessionLockedExempt: false,
          profileImage: null,
          designation: null,
          degrees: null,
          institution: null,
      };
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

      const [foundStudent] = await db.select().from(userSchema).where(and(eq(userSchema.id, studentId), eq(userSchema.role, 'student'))).limit(1);
      student = foundStudent;

      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    const [existingOrder] = await db.select().from(orderSchema).where(and(eq(orderSchema.userId, student.id), eq(orderSchema.courseId, courseId))).limit(1);

    if (existingOrder?.status === 'approved') {
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    let order;
    if (existingOrder) {
      await db.update(orderSchema).set({
          status: 'approved',
          totalAmount: 0,
      }).where(eq(orderSchema.id, existingOrder.id));
      let existingOrderFull = await db.select().from(orderSchema).where(eq(orderSchema.id, existingOrder.id)).limit(1).then(r => r[0] || null);
      let orderCourse = null, orderUser = null;
      if (existingOrderFull) {
        [orderCourse] = existingOrderFull.courseId ? await db.select().from(courseSchema).where(eq(courseSchema.id, existingOrderFull.courseId)).limit(1) : [null];
        [orderUser] = existingOrderFull.userId ? await db.select().from(userSchema).where(eq(userSchema.id, existingOrderFull.userId)).limit(1) : [null];
      }
      order = existingOrderFull ? { ...existingOrderFull, course: orderCourse, user: orderUser } : null;
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(orderSchema).values({
          id: newOrderId,
          userId: student.id,
          courseId,
          status: 'approved',
          totalAmount: 0,
      });
      let newOrderFull = await db.select().from(orderSchema).where(eq(orderSchema.id, newOrderId)).limit(1).then(r => r[0] || null);
      let newOrderCourse = null, newOrderUser = null;
      if (newOrderFull) {
        [newOrderCourse] = newOrderFull.courseId ? await db.select().from(courseSchema).where(eq(courseSchema.id, newOrderFull.courseId)).limit(1) : [null];
        [newOrderUser] = newOrderFull.userId ? await db.select().from(userSchema).where(eq(userSchema.id, newOrderFull.userId)).limit(1) : [null];
      }
      order = newOrderFull ? { ...newOrderFull, course: newOrderCourse, user: newOrderUser } : null;
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

    const enrollmentsData = await db.select().from(orderSchema).where(eq(orderSchema.status, 'approved')).orderBy(desc(orderSchema.createdAt)).limit(100);

    const orderUserIds = [...new Set(enrollmentsData.map(o => o.userId).filter(Boolean))];
    const orderCourseIds = [...new Set(enrollmentsData.map(o => o.courseId).filter(Boolean))];
    const [users, courses] = await Promise.all([
      orderUserIds.length > 0 ? db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email, phone: userSchema.phone }).from(userSchema).where(inArray(userSchema.id, orderUserIds)) : Promise.resolve([]),
      orderCourseIds.length > 0 ? db.select({ id: courseSchema.id, title: courseSchema.title, slug: courseSchema.slug, teacherId: courseSchema.teacherId }).from(courseSchema).where(inArray(courseSchema.id, orderCourseIds)) : Promise.resolve([]),
    ]);
    const usersMap = new Map(users.map(u => [u.id, u]));
    const coursesMap = new Map(courses.map(c => [c.id, c]));
    const enrollments = enrollmentsData.map(o => ({ ...o, user: usersMap.get(o.userId) || null, course: coursesMap.get(o.courseId) || null }));

    // Filter to only include enrollments for courses this teacher owns or manages
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
    const [existingOrder] = await db.select().from(orderSchema).where(eq(orderSchema.id, orderId)).limit(1);
    let existingOrderCourse = null;
    if (existingOrder) {
      [existingOrderCourse] = existingOrder.courseId ? await db.select().from(courseSchema).where(eq(courseSchema.id, existingOrder.courseId)).limit(1) : [null];
    }
    const existingOrderWithCourse = existingOrder ? { ...existingOrder, course: existingOrderCourse } : null;
    
    if (!existingOrderWithCourse) {
        return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }
    
    if (payload.role !== 'admin' && existingOrderWithCourse.course?.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course.' }, { status: 403 });
    }

    await db.delete(orderSchema).where(eq(orderSchema.id, orderId));

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
