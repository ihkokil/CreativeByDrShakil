import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';
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

    const supabase = getSupabase();
    
    // Verify course belongs to this teacher
    const { data: course } = await supabase
      .from('Course')
      .select('*')
      .eq('id', courseId)
      .eq('teacherId', payload.sub)
      .limit(1)
      .maybeSingle();

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

      let query = supabase.from('User').select('id').eq('email', normalizedEmail);
      if (phone) {
        query = supabase.from('User').select('id').or(`email.eq.${normalizedEmail},phone.eq.${phone}`);
      }

      const { data: existingUser } = await query.limit(1).maybeSingle();

      if (existingUser) {
        return NextResponse.json({ error: 'A user with this email or phone already exists.' }, { status: 409 });
      }

      const { token: setupToken, tokenHash } = await createTokenPair();
      const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); 

      const tempPassword = `Temp${Math.random().toString(36).slice(2, 10)}!`;

      const { hash } = await import('bcryptjs');
      const newStudentId = crypto.randomUUID();
      const hashedPassword = await hash(tempPassword, 12);
      const nowStr = new Date().toISOString();

      const insertValues = {
          id: newStudentId,
          email: normalizedEmail,
          fullName,
          phone: phone || null,
          passwordHash: hashedPassword,
          role: 'student',
          emailVerified: true,
          passwordResetTokenHash: tokenHash,
          passwordResetExpires: resetExpiry.toISOString(),
      };

      const { error: insertError } = await supabase.from('User')
// @ts-ignore
.insert(insertValues as any);
      if (insertError) throw insertError;

      student = {
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

      const { data: foundStudent } = await supabase
        .from('User')
        .select('*')
        .eq('id', studentId)
        .eq('role', 'student')
        .limit(1)
        .maybeSingle();
      
      student = foundStudent;

      if (!student) {
        return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
      }
    }

    const { data: existingOrder } = await supabase
      .from('Order')
      .select('*')
      .eq('userId', student.id)
      .eq('courseId', courseId)
      .limit(1)
      .maybeSingle();

    if ((existingOrder as any)?.status === 'approved') {
      return NextResponse.json({ error: 'Student is already enrolled in this course.' }, { status: 409 });
    }

    let order;
    if (existingOrder) {
      await supabase
        .from('Order')
        .update({ status: 'approved', totalAmount: 0 } as any)
        .eq('id', (existingOrder as any).id);
        
      const { data: existingOrderFull } = await supabase.from('Order').select('*').eq('id', (existingOrder as any).id).limit(1).maybeSingle();
      
      let orderCourse = null, orderUser = null;
      if (existingOrderFull) {
        if ((existingOrderFull as any).courseId) {
          const { data } = await supabase.from('Course').select('*').eq('id', (existingOrderFull as any).courseId).limit(1).maybeSingle();
          orderCourse = data;
        }
        if ((existingOrderFull as any).userId) {
          const { data } = await supabase.from('User').select('*').eq('id', (existingOrderFull as any).userId).limit(1).maybeSingle();
          orderUser = data;
        }
      }
      order = existingOrderFull ? { ...(existingOrderFull as any), course: orderCourse, user: orderUser } : null;
    } else {
      const newOrderId = crypto.randomUUID();
      await supabase.from('Order')
// @ts-ignore
.insert({
          id: newOrderId,
          userId: student.id,
          courseId,
          status: 'approved',
          totalAmount: 0,
      } as any);
      
      const { data: newOrderFull } = await supabase.from('Order').select('*').eq('id', newOrderId).limit(1).maybeSingle();
      
      let newOrderCourse = null, newOrderUser = null;
      if (newOrderFull) {
        if ((newOrderFull as any).courseId) {
          const { data } = await supabase.from('Course').select('*').eq('id', (newOrderFull as any).courseId).limit(1).maybeSingle();
          newOrderCourse = data;
        }
        if ((newOrderFull as any).userId) {
          const { data } = await supabase.from('User').select('*').eq('id', (newOrderFull as any).userId).limit(1).maybeSingle();
          newOrderUser = data;
        }
      }
      order = newOrderFull ? { ...(newOrderFull as any), course: newOrderCourse, user: newOrderUser } : null;
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
          id: (course as any).id,
          title: (course as any).title,
        },
        isNewRegistration,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabase();
    
    const { data: enrollmentsData = [] } = await supabase
      .from('Order')
      .select('*')
      .eq('status', 'approved')
      .order('createdAt', { ascending: false })
      .limit(100);

    const orderUserIds = [...new Set((enrollmentsData || []).map((o: any) => o.userId).filter(Boolean))];
    const orderCourseIds = [...new Set((enrollmentsData || []).map((o: any) => o.courseId).filter(Boolean))];
    
    const users = orderUserIds.length > 0 
      ? await supabase.from('User').select('id, fullName, email, phone').in('id', orderUserIds).then(r => r.data || []) 
      : [];
    const courses = orderCourseIds.length > 0
      ? await supabase.from('Course').select('id, title, slug, teacherId').in('id', orderCourseIds).then(r => r.data || [])
      : [];
      
    const usersMap = new Map(users.map((u: any) => [u.id, u]));
    const coursesMap = new Map(courses.map((c: any) => [c.id, c]));
    const enrollments = (enrollmentsData || []).map((o: any) => ({ ...o, user: usersMap.get(o.userId) || null, course: coursesMap.get(o.courseId) || null }));

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

    const supabase = getSupabase();
    const { data: existingOrder } = await supabase.from('Order').select('*').eq('id', orderId).limit(1).maybeSingle();
    
    let existingOrderCourse = null;
    if (existingOrder && (existingOrder as any).courseId) {
      const { data } = await supabase.from('Course').select('*').eq('id', (existingOrder as any).courseId).limit(1).maybeSingle();
      existingOrderCourse = data;
    }
    const existingOrderWithCourse = existingOrder ? { ...(existingOrder as any), course: existingOrderCourse } : null;
    
    if (!existingOrderWithCourse) {
        return NextResponse.json({ error: 'Enrollment not found.' }, { status: 404 });
    }
    
    if (payload.role !== 'admin' && existingOrderWithCourse.course?.teacherId !== payload.sub) {
        return NextResponse.json({ error: 'Forbidden: You do not own this course.' }, { status: 403 });
    }

    await supabase.from('Order').delete().eq('id', orderId);

    return NextResponse.json({
      success: true,
      message: 'Enrollment removed successfully.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
