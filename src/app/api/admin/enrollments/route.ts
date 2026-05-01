import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken, hashPassword } from '@/lib/auth-server';
import { createTokenPair } from '@/lib/token-utils';
import { sendPasswordSetupEmail } from '@/lib/auth-emails';

// GET - List all enrollments with student and course info
export async function GET(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = verifyAuthToken(token);
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const enrollments = await prisma.order.findMany({
      where: { status: 'approved' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
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

    const payload = verifyAuthToken(token);
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
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
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
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [{ email: normalizedEmail }, ...(phone ? [{ phone }] : [])],
          },
        });

        if (existingUser) {
          throw new Error('A user with this email or phone already exists.');
        }

        // Create password reset token for the new student
        const { token: setupTokenPair, tokenHash } = createTokenPair();
        setupToken = setupTokenPair;
        const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create student with a temporary password hash
        const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
        const passwordHashVal = await hashPassword(tempPassword);

        finalStudent = await tx.user.create({
          data: {
            email: normalizedEmail,
            fullName,
            phone: phone || null,
            passwordHash: passwordHashVal,
            role: 'student',
            emailVerified: true,
            passwordResetTokenHash: tokenHash,
            passwordResetExpires: resetExpiry,
          },
        });

        isNewReg = true;
      } else {
        // Use existing student
        if (!studentId) {
          throw new Error('Student ID is required for existing students.');
        }

        finalStudent = await tx.user.findFirst({
          where: { id: studentId, role: 'student' },
        });

        if (!finalStudent) {
          throw new Error('Student not found.');
        }
      }

      // Check if already enrolled
      const existingOrder = await tx.order.findUnique({
        where: { userId_courseId: { userId: finalStudent.id, courseId } },
      });

      if (existingOrder?.status === 'approved') {
        throw new Error('Student is already enrolled in this course.');
      }

      // Create or update order with approved status
      let finalOrder;
      if (existingOrder) {
        finalOrder = await tx.order.update({
          where: { id: existingOrder.id },
          data: { 
            status: 'approved',
            totalAmount: 0,
            discountAmount: 0,
          },
          include: { course: true, user: true },
        });
      } else {
        finalOrder = await tx.order.create({
          data: {
            userId: finalStudent.id,
            courseId,
            status: 'approved',
            totalAmount: 0,
            discountAmount: 0,
          },
          include: { course: true, user: true },
        });
      }

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

    const payload = verifyAuthToken(token);
    if (payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    await prisma.order.delete({
      where: { id: orderId },
    });

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
