import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';

/**
 * POST /api/teacher/courses/[courseId]/self-enroll
 * Enrolls the authenticated teacher or admin into the course and returns the slug to launch /study/[slug].
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload || (payload.role !== 'teacher' && payload.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { courseId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: course, error: courseError } = await supabase
      .from('Course')
      .select('id, title, slug')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    // Check if an approved order already exists
    const { data: existingOrder } = await supabase
      .from('Order')
      .select('id, status')
      .eq('userId', payload.sub)
      .eq('courseId', course.id)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (!existingOrder) {
      const now = new Date().toISOString();
      const orderId = crypto.randomUUID();

      const { error: insertError } = await supabase
        .from('Order')
        // @ts-ignore
        .insert({
          id: orderId,
          userId: payload.sub,
          courseId: course.id,
          totalAmount: 0,
          status: 'approved',
          enrolledAt: now,
          createdAt: now,
          updatedAt: now,
        });

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: 'Enrolled successfully!',
      slug: course.slug,
    });
  } catch (error: any) {
    console.error('Self enroll error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enroll into course' },
      { status: 500 }
    );
  }
}
