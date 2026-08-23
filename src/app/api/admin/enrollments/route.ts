import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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

    const supabase = getSupabaseAdmin();

    const { data: enrollmentsData = [] } = await supabase
      .from('Order')
      .select('*')
      .eq('status', 'approved')
      .order('createdAt', { ascending: false })
      .limit(100);

    const orderUserIds = [...new Set((enrollmentsData || []).map((o: any) => o.userId).filter(Boolean))];
    const orderCourseIds = [...new Set((enrollmentsData || []).map((o: any) => o.courseId).filter(Boolean))];
    
    const [{ data: users = [] }, { data: courses = [] }] = await Promise.all([
      orderUserIds.length > 0
        ? supabase.from('User').select('id, fullName, email, phone').in('id', orderUserIds)
        : Promise.resolve({ data: [] }),
      orderCourseIds.length > 0
        ? supabase.from('Course').select('id, title, slug').in('id', orderCourseIds)
        : Promise.resolve({ data: [] }),
    ]);
    
    const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
    const coursesMap = new Map((courses || []).map((c: any) => [c.id, c]));
    
    const enrollments = (enrollmentsData || []).map((o: any) => ({
      ...o,
      user: usersMap.get(o.userId) || null,
      course: coursesMap.get(o.courseId) || null,
    }));

    return NextResponse.json({
      enrollments: enrollments.map((e: any) => ({
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

    const supabase = getSupabaseAdmin();

    // Verify course exists
    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, title, slug')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

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

      let query = supabase.from('User').select('id').eq('email', normalizedEmail);
      if (phone) {
        query = supabase.from('User').select('id').or(`email.eq.${normalizedEmail},phone.eq.${phone}`);
      }

      const { data: existingUser }: { data: any } = await query.limit(1).maybeSingle();

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupTokenPair, tokenHash } = await createTokenPair();
      setupToken = setupTokenPair;
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;
      
      const { hash } = await import('bcryptjs');
      const generatedId = crypto.randomUUID();
      const hashedPassword = await hash(tempPassword, 8);
      const nowStr = new Date().toISOString();

      const insertValues = {
        id: generatedId,
        email: normalizedEmail,
        fullName,
        phone: phone || null,
        passwordHash: hashedPassword,
        role: 'student',
        emailVerified: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpires: resetExpiry.toISOString(),
        createdAt: nowStr,
        updatedAt: nowStr,
        canManagePayments: false,
        isBanned: false,
        isSessionLockedExempt: false,
      };

      // @ts-ignore: Supabase JS types expect never[] if schema is not well-defined
      const { error: insertError } = await supabase.from('User')
// @ts-ignore
.insert(insertValues);
      
      if (insertError) {
        return NextResponse.json({ error: 'Failed to create student.' }, { status: 500 });
      }

      finalStudent = insertValues;
      newlyCreatedUserId = generatedId;
      isNewReg = true;
    } else {
      if (!studentId) {
        return NextResponse.json({ error: 'Student ID is required for existing students.' }, { status: 400 });
      }

      const { data: foundFinalStudent }: { data: any } = await supabase
        .from('User')
        .select('*')
        .eq('id', studentId)
        .eq('role', 'student')
        .limit(1)
        .maybeSingle();
        
      finalStudent = foundFinalStudent;

      if (!finalStudent) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    // Pre-check duplicate approved enrollment
    const { data: existingApproved }: { data: any } = await supabase
      .from('Order')
      .select('id')
      .eq('userId', finalStudent.id)
      .eq('courseId', courseId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();
      
    if (existingApproved) {
      if (newlyCreatedUserId) {
        await supabase.from('User').delete().eq('id', newlyCreatedUserId);
      }
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    try {
      await ensureCourseEnrollment(
        null,
        finalStudent.id,
        course.id,
        course.title,
        course.slug,
        true
      );
    } catch (enrollErr) {
      if (newlyCreatedUserId) {
        try {
          await supabase.from('User').delete().eq('id', newlyCreatedUserId);
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      throw enrollErr;
    }

    const { data: finalOrderRow }: { data: any } = await supabase
      .from('Order')
      .select('*')
      .eq('userId', finalStudent.id)
      .eq('courseId', course.id)
      .limit(1)
      .maybeSingle();

    let finalOrderCourse = null, finalOrderUser = null;
    if (finalOrderRow) {
      if (finalOrderRow.courseId) {
        const { data: c }: { data: any } = await supabase.from('Course').select('id, title').eq('id', finalOrderRow.courseId).limit(1).maybeSingle();
        finalOrderCourse = c;
      }
      if (finalOrderRow.userId) {
        const { data: u }: { data: any } = await supabase.from('User').select('id, fullName, email, phone').eq('id', finalOrderRow.userId).limit(1).maybeSingle();
        finalOrderUser = u;
      }
    }
    const finalOrder = finalOrderRow ? { ...finalOrderRow, course: finalOrderCourse, user: finalOrderUser } : null;

    if (!finalOrder) {
      if (newlyCreatedUserId) {
        try {
          await supabase.from('User').delete().eq('id', newlyCreatedUserId);
        } catch (cleanupErr) {
          console.error('[admin/enrollments] Compensation delete failed:', cleanupErr);
        }
      }
      return NextResponse.json({ error: 'Failed to create enrollment.' }, { status: 500 });
    }

    const result = { student: finalStudent, isNewRegistration: isNewReg, order: finalOrder, setupToken };
    const { student: studentResult, isNewRegistration: finalIsNewReg, order, setupToken: resultSetupToken } = result;

    if (finalIsNewReg && resultSetupToken) {
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

    const supabase = getSupabaseAdmin();
    await supabase.from('Order').delete().eq('id', orderId);

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
