import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, user as userSchema, course as courseSchema } from '@/db/schema';
import { eq, sql, or, and, asc, desc, inArray } from 'drizzle-orm';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';
import { ensureCourseEnrollment } from '@/lib/enrollment';


// GET - List all enrollments with student and course info
export async function GET(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const enrollmentsData = await db.select().from(orderSchema).where(eq(orderSchema.status, 'approved')).orderBy(desc(orderSchema.createdAt)).limit(100);

    const orderUserIds = [...new Set(enrollmentsData.map(o => o.userId).filter(Boolean))];
    const orderCourseIds = [...new Set(enrollmentsData.map(o => o.courseId).filter(Boolean))];
    const [users, courses] = await Promise.all([
      orderUserIds.length > 0 ? db.select({ id: userSchema.id, fullName: userSchema.fullName, email: userSchema.email, phone: userSchema.phone }).from(userSchema).where(inArray(userSchema.id, orderUserIds)) : Promise.resolve([]),
      orderCourseIds.length > 0 ? db.select({ id: courseSchema.id, title: courseSchema.title, slug: courseSchema.slug }).from(courseSchema).where(inArray(courseSchema.id, orderCourseIds)) : Promise.resolve([]),
    ]);
    const usersMap = new Map(users.map(u => [u.id, u]));
    const coursesMap = new Map(courses.map(c => [c.id, c]));
    const enrollments = enrollmentsData.map(o => ({ ...o, user: usersMap.get(o.userId) || null, course: coursesMap.get(o.courseId) || null }));

    return NextResponse.json({
      enrollments: enrollments.map((e) => ({
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

// POST - Enroll a student to a course (existing or new student)
export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
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

    // Verify course exists
    const [course] = await db.select().from(courseSchema).where(eq(courseSchema.id, courseId)).limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // neon-http driver does not support transactions — execute sequentially.
// We do user creation first (with pre-checks), then enrollment. If enrollment
// fails after a brand-new user was inserted, we compensate by deleting that user
// so we never leave an orphan account.
    let finalStudent: any;
    let isNewReg = false;
    let setupToken: string | null = null;
    let newlyCreatedUserId: string | null = null;

    if (isNewStudent) {
      if (!email || !fullName) {
        return NextResponse.json({ error: 'Email and full name are required for new students.' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const [existingUser] = await db.select().from(userSchema).where(or(eq(userSchema.email, normalizedEmail), phone ? eq(userSchema.phone, phone) : undefined)).limit(1);

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupTokenPair, tokenHash } = await createTokenPair();
      setupToken = setupTokenPair;
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
      

      const { hash } = await import('bcryptjs');
      const generatedId = crypto.randomUUID();
      const hashedPassword = await hash(tempPassword, 12);
      const nowStr = new Date().toISOString();

      const insertValues = {
        id: generatedId,
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

      const newUser = {
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
      finalStudent = newUser;
      newlyCreatedUserId = newUser.id;
      isNewReg = true;
    } else {
      if (!studentId) {
        return NextResponse.json({ error: 'Student ID is required for existing students.' }, { status: 400 });
      }

      const [foundFinalStudent] = await db.select().from(userSchema).where(and(eq(userSchema.id, studentId), eq(userSchema.role, 'student'))).limit(1);
      finalStudent = foundFinalStudent;

      if (!finalStudent) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    // Pre-check duplicate approved enrollment to fail fast with a clear error.
    const [existingApproved] = await db.select().from(orderSchema).where(and(eq(orderSchema.userId, finalStudent.id), eq(orderSchema.courseId, courseId), eq(orderSchema.status, 'approved'))).limit(1);
    if (existingApproved) {
      // Compensate: if we just created a new user, delete it to avoid orphan.
      if (newlyCreatedUserId) {
        await db.delete(userSchema).where(eq(userSchema.id, newlyCreatedUserId));
      }
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    try {
      await ensureCourseEnrollment(
        db,
        finalStudent.id,
        course.id,
        course.title,
        course.slug,
        true
      );
    } catch (enrollErr) {
      // Compensate: if we just created a new user, delete it to avoid orphan.
      if (newlyCreatedUserId) {
        try {
          await db.delete(userSchema).where(eq(userSchema.id, newlyCreatedUserId));
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      throw enrollErr;
    }

    const [finalOrderRow] = await db.select().from(orderSchema).where(and(eq(orderSchema.userId, finalStudent.id), eq(orderSchema.courseId, course.id))).limit(1);
    let finalOrderCourse = null, finalOrderUser = null;
    if (finalOrderRow) {
      [finalOrderCourse] = finalOrderRow.courseId ? await db.select().from(courseSchema).where(eq(courseSchema.id, finalOrderRow.courseId)).limit(1) : [null];
      [finalOrderUser] = finalOrderRow.userId ? await db.select().from(userSchema).where(eq(userSchema.id, finalOrderRow.userId)).limit(1) : [null];
    }
    const finalOrder = finalOrderRow ? { ...finalOrderRow, course: finalOrderCourse, user: finalOrderUser } : null;

    if (!finalOrder) {
      // Compensate: if we just created a new user, delete it.
      if (newlyCreatedUserId) {
        try {
          await db.delete(userSchema).where(eq(userSchema.id, newlyCreatedUserId));
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
    }

    const result = { student: finalStudent, isNewRegistration: isNewReg, order: finalOrder, setupToken };

    const { student: studentResult, isNewRegistration: finalIsNewReg, order, setupToken: resultSetupToken } = result;

    if (finalIsNewReg && resultSetupToken) {
      // Send password setup email outside transaction
      try {
        await sendPasswordSetupEmail({
          email: studentResult.email,
          fullName: studentResult.fullName,
          token: resultSetupToken,
        });
      } catch (emailError) {
        console.error('Failed to send password setup email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: finalIsNewReg
        ? `Student enrolled successfully. A password setup email has been sent to ${studentResult.email}.`
        : 'Student enrolled successfully.',
      enrollment: {
        id: order.id,
        student: {
          id: studentResult.id,
          fullName: studentResult.fullName,
          email: studentResult.email,
          phone: studentResult.phone,
        },
        course: {
          id: course.id,
          title: course.title,
        },
        isNewRegistration: finalIsNewReg,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

// DELETE - Remove enrollment
export async function DELETE(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
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
