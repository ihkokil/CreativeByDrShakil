import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
    const course = await db.course.findFirst({
      where: {
        id: courseId,
        teacherId: payload.sub,
      },
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

      const existingUser = await db.user.findFirst({
        where: {
          OR: phone ? [
            { email: normalizedEmail },
            { phone: phone }
          ] : [
            { email: normalizedEmail }
          ]
        },
      });

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); 
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

      // Use raw query for pgcrypto gen_salt and crypt
      const result = await db.$queryRaw`
        INSERT INTO "User" (
          id, email, "fullName", phone, "passwordHash", role, "emailVerified", "passwordResetTokenHash", "passwordResetExpires", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${normalizedEmail},
          ${fullName},
          ${phone || null},
          crypt(${tempPassword}, gen_salt('bf', 12)),
          'student',
          true,
          ${tokenHash},
          ${resetExpiry.toISOString()}::timestamp(3),
          NOW(),
          NOW()
        ) RETURNING *;
      `;
      
      student = (result as any[])[0];
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

      student = await db.user.findFirst({
        where: {
          id: studentId,
          role: 'student',
        },
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    const existingOrder = await db.order.findFirst({
      where: {
        userId: student.id,
        courseId: courseId,
      },
    });

    if (existingOrder?.status === 'approved') {
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    let order;
    if (existingOrder) {
      order = await db.order.update({
        where: { id: existingOrder.id },
        data: {
          status: 'approved',
          totalAmount: 0,
        },
        include: { course: true, user: true },
      });
    } else {
      order = await db.order.create({
        data: {
          id: crypto.randomUUID(),
          userId: student.id,
          courseId,
          status: 'approved',
          totalAmount: 0,
        },
        include: { course: true, user: true },
      });
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

    const enrollments = await db.order.findMany({
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
            teacherId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

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
    const existingOrder = await db.order.findUnique({
        where: { id: orderId },
        include: { course: true }
    });
    
    if (!existingOrder) {
        return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }
    
    if (payload.role !== 'admin' && existingOrder.course?.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course.' }, { status: 403 });
    }

    await db.order.delete({ where: { id: orderId } });

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
