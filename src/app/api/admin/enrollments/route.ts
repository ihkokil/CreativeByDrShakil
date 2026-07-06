import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';
import { ensureCourseEnrollment } from '@/lib/enrollment';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import bcrypt from 'bcryptjs';


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

    const enrollments = await db.query.orders.findMany({
      where: eq(schema.orders.status, 'approved'),
      orderBy: [desc(schema.orders.createdAt)],
      limit: 100,
    });

    // Batch-fetch related users and courses (MariaDB-compatible flat queries)
    const userIds = [...new Set(enrollments.map(e => e.userId).filter(Boolean))] as string[];
    const courseIds = [...new Set(enrollments.map(e => e.courseId).filter(Boolean))] as string[];

    const [usersData, coursesData] = await Promise.all([
      userIds.length > 0
        ? db.query.users.findMany({ where: inArray(schema.users.id, userIds), columns: { id: true, fullName: true, email: true, phone: true } })
        : [],
      courseIds.length > 0
        ? db.query.courses.findMany({ where: inArray(schema.courses.id, courseIds), columns: { id: true, title: true, slug: true } })
        : [],
    ]);

    const userMap = new Map(usersData.map(u => [u.id, u]));
    const courseMap = new Map(coursesData.map(c => [c.id, c]));

    return NextResponse.json({
      enrollments: enrollments.map((e) => ({
        id: e.id,
        student: userMap.get(e.userId) ?? null,
        course: courseMap.get(e.courseId) ?? null,
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
    const course = await db.query.courses.findFirst({
      where: eq(schema.courses.id, courseId),
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    let finalStudent: any;
    let isNewReg = false;
    let setupToken: string | null = null;
    let newlyCreatedUserId: string | null = null;

    if (isNewStudent) {
      if (!email || !fullName) {
        return NextResponse.json({ error: 'Email and full name are required for new students.' }, { status: 400 });
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const existingUser = await db.query.users.findFirst({
        where: or(
          eq(schema.users.email, normalizedEmail),
          ...(phone ? [eq(schema.users.phone, phone)] : [])
        )
      });

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupTokenPair, tokenHash } = await createTokenPair();
      setupToken = setupTokenPair;
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
      const hashedTempPassword = await bcrypt.hash(tempPassword, 12);
      

      const newUserId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: newUserId,
        email: normalizedEmail,
        fullName: fullName,
        phone: phone || null,
        passwordHash: hashedTempPassword,
        role: 'student',
        emailVerified: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: resetExpiry,
        updatedAt: new Date(),
      });
      const newUser = await db.query.users.findFirst({ where: eq(schema.users.id, newUserId) });
      if (!newUser) {
        return NextResponse.json({ error: 'Failed to create student.' }, { status: 500 });
      }

      finalStudent = newUser;
      newlyCreatedUserId = newUser.id;
      isNewReg = true;
    } else {
      if (!studentId) {
        return NextResponse.json({ error: 'Student ID is required for existing students.' }, { status: 400 });
      }

      finalStudent = await db.query.users.findFirst({
        where: and(eq(schema.users.id, studentId), eq(schema.users.role, 'student'))
      });

      if (!finalStudent) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    // Pre-check duplicate approved enrollment to fail fast with a clear error.
    const existingApproved = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.userId, finalStudent.id),
        eq(schema.orders.courseId, courseId),
        eq(schema.orders.status, 'approved')
      )
    });
    if (existingApproved) {
      // Compensate: if we just created a new user, delete it to avoid orphan.
      if (newlyCreatedUserId) {
        await db.delete(schema.users).where(eq(schema.users.id, newlyCreatedUserId));
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
          await db.delete(schema.users).where(eq(schema.users.id, newlyCreatedUserId));
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      throw enrollErr;
    }

    const finalOrder = await db.query.orders.findFirst({
      where: and(
        eq(schema.orders.userId, finalStudent.id),
        eq(schema.orders.courseId, course.id)
      ),
    });

    if (!finalOrder) {
      // Compensate: if we just created a new user, delete it.
      if (newlyCreatedUserId) {
        try {
          await db.delete(schema.users).where(eq(schema.users.id, newlyCreatedUserId));
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
    }

    // Flat lookups for related data (MariaDB-compatible)
    const [orderCourse, orderUser] = await Promise.all([
      db.query.courses.findFirst({ where: eq(schema.courses.id, finalOrder.courseId) }),
      db.query.users.findFirst({ where: eq(schema.users.id, finalOrder.userId) }),
    ]);
    const finalOrderWithRelations = { ...finalOrder, course: orderCourse ?? null, user: orderUser ?? null };

    const result = { student: finalStudent, isNewRegistration: isNewReg, order: finalOrderWithRelations, setupToken };

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

    await db.delete(schema.orders).where(eq(schema.orders.id, orderId));

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
