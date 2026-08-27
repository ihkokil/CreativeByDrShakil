import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { ensureCourseEnrollment } from '@/lib/enrollment';

/**
 * GET /api/students - Returns a list of all student users, sessions, and courses.
 * POST /api/students - Batch enrolls multiple student IDs into a course.
 * Accessible by: Admin, Teacher
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const { data: studentsList = [] } = await supabase
      .from('User')
      .select('id, fullName, email, phone, bmdcNumber, role, createdAt, profileImage')
      .eq('role', 'student')
      .order('createdAt', { ascending: false });

    const studentIds = (studentsList || []).map((s: any) => s.id);

    const [{ data: deviceSessionsList = [] }, { data: ordersList = [] }] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('DeviceSession').select('*').in('userId', studentIds).order('createdAt', { ascending: false })
        : Promise.resolve({ data: [] }),
      studentIds.length > 0
        ? supabase.from('Order').select('id, userId, enrolledAt, expiresAt, courseId, batchId').in('userId', studentIds).eq('status', 'approved')
        : Promise.resolve({ data: [] }),
    ]);

    const orderCourseIds = [...new Set((ordersList || []).map((o: any) => o.courseId).filter(Boolean))];
    const orderBatchIds = [...new Set((ordersList || []).map((o: any) => o.batchId).filter(Boolean))];

    const [{ data: coursesList = [] }, { data: batchesList = [] }] = await Promise.all([
      orderCourseIds.length > 0
        ? supabase.from('Course').select('id, title, slug').in('id', orderCourseIds)
        : Promise.resolve({ data: [] }),
      orderBatchIds.length > 0
        ? supabase.from('Batch').select('id, name, startDate').in('id', orderBatchIds)
        : Promise.resolve({ data: [] }),
    ]);
      
    const courseMap = new Map<string, any>((coursesList || []).map((c: any) => [c.id, c]));
    const batchMap = new Map<string, any>((batchesList || []).map((b: any) => [b.id, b]));

    const deviceSessionsMap = new Map<string, any[]>();
    for (const ds of (deviceSessionsList as any[] || [])) {
      const list = deviceSessionsMap.get(ds.userId) || [];
      list.push(ds);
      deviceSessionsMap.set(ds.userId, list);
    }

    const ordersMap = new Map<string, any[]>();
    for (const o of (ordersList as any[] || [])) {
      const course = courseMap.get(o.courseId);
      if (course) {
        const batch = o.batchId ? batchMap.get(o.batchId) : null;
        const list = ordersMap.get(o.userId) || [];
        list.push({
          id: o.id,
          enrolledAt: o.enrolledAt,
          expiresAt: o.expiresAt,
          batchId: o.batchId || null,
          batchName: batch?.name || null,
          batchStartDate: batch?.startDate || null,
          course: {
            id: course.id,
            title: course.title,
            slug: course.slug,
          },
        });
        ordersMap.set(o.userId, list);
      }
    }

    const students = (studentsList || []).map((s: any) => ({
      ...s,
      deviceSessions: deviceSessionsMap.get(s.id) || [],
      orders: ordersMap.get(s.id) || [],
    }));

    const formattedStudents = students.map((student: any) => {
      const activeSessions = student.deviceSessions.filter((s: any) => !s.loggedOutAt && !s.isLocked);

      return {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        bmdcNumber: student.bmdcNumber,
        role: student.role,
        createdAt: student.createdAt,
        profileImage: student.profileImage,
        activeSessions,
        sessions: activeSessions, // compatibility
        enrolledCourses: student.orders.map((order: any) => ({
          orderId: order.id,
          courseId: order.course.id,
          courseTitle: order.course.title,
          courseSlug: order.course.slug,
          enrolledAt: order.enrolledAt,
          expiresAt: order.expiresAt,
          batchId: order.batchId || null,
          batchName: order.batchName || null,
          batchStartDate: order.batchStartDate || null,
        })),
      };
    });

    return NextResponse.json({ students: formattedStudents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { studentIds, courseId, batchId, enrolledAt: enrolledAtStr } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds array is required.' }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: course }: { data: any } = await supabase
      .from('Course')
      .select('id, title, slug')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const enrolledAt = enrolledAtStr ? new Date(enrolledAtStr) : new Date();
    if (Number.isNaN(enrolledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid enrolledAt date provided.' }, { status: 400 });
    }
    const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    const enrolledStudents: string[] = [];
    const errors: string[] = [];

    for (const studentId of studentIds) {
      try {
        const { data: student }: { data: any } = await supabase
          .from('User')
          .select('id, fullName')
          .eq('id', studentId)
          .eq('role', 'student')
          .limit(1)
          .maybeSingle();

        if (!student) {
          errors.push(`Student with ID ${studentId} not found.`);
          continue;
        }

        await ensureCourseEnrollment(
          null,
          student.id,
          course.id,
          course.title,
          course.slug,
          true, // enrolledByAdmin
          enrolledAt,
          expiresAt,
          batchId || null
        );

        enrolledStudents.push(student.fullName);
      } catch (err: any) {
        errors.push(`Failed to enroll student ${studentId}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enrolled ${enrolledStudents.length} student(s) successfully.`,
      enrolledStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
