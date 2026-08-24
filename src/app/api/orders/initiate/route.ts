import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';
import { nanoid } from '@/lib/nanoid';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId } = body;

    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify the course exists and is published
    const { data: course, error: courseError }: { data: any; error: any } = await supabase
      .from('Course')
      .select('id, title, slug, price, salePrice, status')
      .eq('id', courseId)
      .limit(1)
      .maybeSingle();

    if (courseError) throw courseError;

    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    if (course.status !== 'published') {
      return NextResponse.json({ error: 'Course is not available for purchase.' }, { status: 400 });
    }

    // Check if the student already has an active (approved) order for this course
    const { data: existingOrder }: { data: any } = await supabase
      .from('Order')
      .select('id, status')
      .eq('userId', payload.sub)
      .eq('courseId', courseId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle();

    if (existingOrder) {
      return NextResponse.json({ error: 'You are already enrolled in this course.' }, { status: 409 });
    }

    // Check for an existing pending order
    const { data: pendingOrder }: { data: any } = await supabase
      .from('Order')
      .select('id, status')
      .eq('userId', payload.sub)
      .eq('courseId', courseId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (pendingOrder) {
      const totalAmount = course.salePrice ?? course.price ?? 0;
      return NextResponse.json({
        orderId: pendingOrder.id,
        order: { id: pendingOrder.id, totalAmount, status: 'pending' },
        status: 'pending',
        totalAmount,
        message: 'You already have a pending order for this course.',
        course: { id: course.id, title: course.title, slug: course.slug },
      });
    }

    // Create a new order
    const totalAmount = course.salePrice ?? course.price ?? 0;
    const nowStr = new Date().toISOString();
    const orderId = nanoid();

    const { error: insertError } = await supabase.from('Order')
      // @ts-ignore
      .insert({
        id: orderId,
        userId: payload.sub,
        courseId: course.id,
        totalAmount,
        status: 'pending',
        createdAt: nowStr,
        updatedAt: nowStr,
      } as any);

    if (insertError) throw insertError;

    return NextResponse.json({
      orderId,
      order: { id: orderId, totalAmount, status: 'pending' },
      status: 'pending',
      totalAmount,
      course: { id: course.id, title: course.title, slug: course.slug },
    });
  } catch (error: any) {
    console.error('[orders/initiate] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
