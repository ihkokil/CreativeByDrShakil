import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { order as orderSchema, user as userSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractBearerToken, extractCookieToken, verifyAuthToken, hashPassword } from '@/lib/auth-server';
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

    const enrollments = await db.query.order.findMany({
      where: (o, { eq }) => eq(o.status, 'approved'),
      with: {
        user: {
          columns: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        course: {
          columns: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      limit: 100,
    });

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
    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      let finalStudent;
      let isNewReg = false;
      let setupToken = null;

      if (isNewStudent) {
        // Register new student
        if (!email || !fullName) {
          throw new Error('Email and full name are required for new students.');
        }

        const normalizedEmail = String(email).trim().toLowerCase();

        // Check if user already exists
        const existingUser = await tx.query.user.findFirst({
          where: (u, { eq, or }) => or(eq(u.email, normalizedEmail), phone ? eq(u.phone, phone) : undefined),
        });

        if (existingUser) {
          throw new Error('A user with this email or phone already exists.');
        }

        // Create password reset token for the new student
        const { token: setupTokenPair, tokenHash } = await createTokenPair();
        setupToken = setupTokenPair;
        const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create student with a temporary password hash
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        const passwordHashVal = await hashPassword(tempPassword);

        const [newUser] = await tx.insert(userSchema).values({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          fullName,
          phone: phone || null,
          passwordHash: passwordHashVal,
          role: 'student',
          emailVerified: true,
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
        }).returning();
        finalStudent = newUser;

        isNewReg = true;
      } else {
        // Use existing student
        if (!studentId) {
          throw new Error('Student ID is required for existing students.');
        }

        finalStudent = await tx.query.user.findFirst({
          where: (u, { eq, and }) => and(eq(u.id, studentId), eq(u.role, 'student')),
        });

        if (!finalStudent) {
          throw new Error('Student not found.');
        }
      }

      // Check if already enrolled
      const existingOrder = await tx.query.order.findFirst({
        where: (o, { eq, and }) => and(eq(o.userId, finalStudent.id), eq(o.courseId, courseId)),
      });

      if (existingOrder?.status === 'approved') {
        throw new Error('Student is already enrolled in this course.');
      }

      // Enroll the student using the helper (handles Basics bundle)
      await ensureCourseEnrollment(
        tx,
        finalStudent.id,
        course.id,
        course.title,
        course.slug,
        true
      );

      // Fetch the order created/updated by the helper to return it
      const finalOrder = await tx.query.order.findFirst({
        where: (o, { eq, and }) => and(eq(o.userId, finalStudent.id), eq(o.courseId, course.id)),
        with: { course: true, user: true },
      });

      if (!finalOrder) throw new Error('Failed to create enrollment.');

      return { student: finalStudent, isNewRegistration: isNewReg, order: finalOrder, setupToken };
    });

    const { student: studentResult, isNewRegistration: finalIsNewReg, order, setupToken } = result;

    if (finalIsNewReg && setupToken) {
      // Send password setup email outside transaction
      try {
        await sendPasswordSetupEmail({
          email: studentResult.email,
          fullName: studentResult.fullName,
          token: setupToken,
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
