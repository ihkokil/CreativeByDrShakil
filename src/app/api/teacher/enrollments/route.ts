import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { course as courseSchema, user as userSchema, order as orderSchema } from '@/db/schema';
import { eq, or, and } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth-server';
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

    // Verify course exists
    const course = await db.query.course.findFirst({
      where: (c, { eq }) => eq(c.id, courseId),
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

      const existingUser = await db.query.user.findFirst({
        where: (u, { eq, or }) => phone ? or(eq(u.email, normalizedEmail), eq(u.phone, phone)) : eq(u.email, normalizedEmail),
      });

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); 

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
      const passwordHash = await hashPassword(tempPassword);

      const [newStudent] = await db.insert(userSchema).values({
          id: crypto.randomUUID(),
          email: normalizedEmail,
          fullName,
          phone: phone || null,
          passwordHash,
          role: 'student',
          emailVerified: true,
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
      }).returning();
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

      student = await db.query.user.findFirst({
        where: (u, { eq, and }) => and(eq(u.id, studentId), eq(u.role, 'student')),
      });

      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    const existingOrder = await db.query.order.findFirst({
      where: (o, { eq, and }) => and(eq(o.userId, student.id), eq(o.courseId, courseId)),
    });

    if (existingOrder?.status === 'approved') {
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    let order;
    if (existingOrder) {
      const [updatedOrder] = await db.update(orderSchema).set({
          status: 'approved',
          totalAmount: 0,
      }).where(eq(orderSchema.id, existingOrder.id)).returning();
      order = await db.query.order.findFirst({
        where: (o, { eq }) => eq(o.id, updatedOrder.id),
        with: { course: true, user: true },
      });
    } else {
      const newOrderId = crypto.randomUUID();
      await db.insert(orderSchema).values({
          id: newOrderId,
          userId: student.id,
          courseId,
          status: 'approved',
          totalAmount: 0,
      });
      order = await db.query.order.findFirst({
        where: (o, { eq }) => eq(o.id, newOrderId),
        with: { course: true, user: true },
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
