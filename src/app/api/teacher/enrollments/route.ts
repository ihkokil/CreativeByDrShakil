import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
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
      batchId,
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

    let batch: any = null;
    if (batchId) {
      const { data: batchData } = await (supabase as any)
        .from('Batch')
        .select('*')
        .eq('id', batchId)
        .eq('courseId', courseId)
        .limit(1)
        .maybeSingle();
      if (!batchData) {
        return NextResponse.json({ error: 'Batch not found for this course.' }, { status: 404 });
      }
      batch = batchData;
    }

    let enrolledStudents: any[] = [];
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

      enrolledStudents.push(newStudent);
      isNewRegistration = true;

      try {
        await sendPasswordSetupEmail({
          email: newStudent.email,
          fullName: newStudent.fullName,
          token: setupToken,
        });
      } catch (emailError) {
        console.error('Failed to send password setup email:', emailError);
      }
    } else {
      const studentIds = body.studentIds || (studentId ? [studentId] : []);
      if (studentIds.length === 0) {
        return NextResponse.json({ error: 'Student ID(s) are required for existing students.' }, { status: 400 });
      }

      const { data: foundStudents } = await supabase
        .from('User')
        .select('*')
        .in('id', studentIds)
        .eq('role', 'student');
      
      if (!foundStudents || foundStudents.length === 0) {
        return NextResponse.json({ error: 'Students not found.' }, { status: 404 });
      }
      enrolledStudents = foundStudents;
    }

    let successfulEnrollments = [];

    for (const student of enrolledStudents) {
      const { data: existingOrder } = await supabase
        .from('Order')
        .select('*')
        .eq('userId', student.id)
        .eq('courseId', courseId)
        .limit(1)
        .maybeSingle();

      // Allow re-enrolling or moving students to a new batch even if they are already approved
      
      let finalEnrolledAt = new Date().toISOString();
      if (batch) {
        finalEnrolledAt = batch.startDate;
      } else if (body.customDate) {
        finalEnrolledAt = new Date(body.customDate).toISOString();
      } else if (existingOrder && existingOrder.enrolledAt) {
        finalEnrolledAt = existingOrder.enrolledAt;
      }

      const oneYearLater = new Date(finalEnrolledAt);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      const finalExpiresAt = oneYearLater.toISOString();

      let order;
      if (existingOrder) {
        const nowStr = new Date().toISOString();
        const updateData: any = { 
          status: 'approved', 
          totalAmount: 0, 
          updatedAt: nowStr 
        };
        
        if (batch) {
          updateData.batchId = batch.id;
          updateData.enrolledAt = finalEnrolledAt;
          updateData.expiresAt = finalExpiresAt;
        } else if (body.customDate || !existingOrder.enrolledAt) {
          updateData.enrolledAt = finalEnrolledAt;
          updateData.expiresAt = finalExpiresAt;
        }

        const { error: updateError } = await supabase
          .from('Order')
          .update(updateData)
          .eq('id', (existingOrder as any).id);
        
        if (updateError) {
          console.error(`Failed to update order for ${student.email}: ${updateError.message}`);
          continue;
        }
        order = { ...(existingOrder as any), ...updateData };
      } else {
        const nowStr = new Date().toISOString();
        const newOrderId = crypto.randomUUID();
        const newOrder = {
            id: newOrderId,
            userId: student.id,
            courseId,
            status: 'approved',
            totalAmount: 0,
            createdAt: nowStr,
            updatedAt: nowStr,
            batchId: batch ? batch.id : null,
            enrolledAt: finalEnrolledAt,
            expiresAt: finalExpiresAt,
        };
        const { error: orderInsertError } = await supabase.from('Order')
// @ts-ignore
.insert(newOrder as any);
        
        if (orderInsertError) {
          console.error(`Failed to create order for ${student.email}: ${orderInsertError.message}`);
          continue;
        }
        order = newOrder;
      }
      successfulEnrollments.push({ student, order });
    }

    if (successfulEnrollments.length === 0) {
      return NextResponse.json({ error: 'No students were enrolled. They might already be enrolled in this course.' }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: isNewRegistration
        ? `Student enrolled successfully. A password setup email has been sent to ${enrolledStudents[0].email}.`
        : `${successfulEnrollments.length} student(s) enrolled successfully.`,
      enrollmentsCount: successfulEnrollments.length,
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

    const supabase = getSupabaseAdmin();
    
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
    
    // Fetch batch names if batchId is present
    const batchIds = [...new Set((enrollmentsData || []).map((o: any) => o.batchId).filter(Boolean))];
    let batchesMap = new Map();
    if (batchIds.length > 0) {
      const { data: batches } = await (supabase as any).from('Batch').select('id, name').in('id', batchIds);
      batchesMap = new Map((batches || []).map((b: any) => [b.id, b]));
    }

    const enrollments = (enrollmentsData || []).map((o: any) => ({ 
      ...o, 
      user: usersMap.get(o.userId) || null, 
      course: coursesMap.get(o.courseId) || null,
      batchName: o.batchId ? batchesMap.get(o.batchId)?.name : null
    }));

    let teacherEnrollments = enrollments;
    if (payload.role !== 'admin') {
       teacherEnrollments = enrollments.filter(e => e.course?.teacherId === payload.sub);
    }

    return NextResponse.json({
      enrollments: teacherEnrollments.map((e) => ({
        id: e.id,
        student: e.user,
        course: e.course,
        batchName: e.batchName,
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

    const supabase = getSupabaseAdmin();
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
