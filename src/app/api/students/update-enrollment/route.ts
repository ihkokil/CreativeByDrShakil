import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth-server';

/**
 * POST /api/students/update-enrollment
 * Updates the enrollment date and auto-calculates the 1-year expiry date for a student enrollment.
 * Accessible by: Admin, Teacher
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, enrolledAt: enrolledAtStr } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    if (!enrolledAtStr) {
      return NextResponse.json({ error: 'enrolledAt date is required.' }, { status: 400 });
    }

    const enrolledAt = new Date(enrolledAtStr);
    if (Number.isNaN(enrolledAt.getTime())) {
      return NextResponse.json({ error: 'Invalid enrolledAt date.' }, { status: 400 });
    }

    // Expiry date is exactly 1 year (365 days) later
    const expiresAt = new Date(enrolledAt.getTime() + 365 * 24 * 60 * 60 * 1000);

    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { id: true, status: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Enrollment order not found.' }, { status: 404 });
    }

    await db.update(schema.orders)
      .set({
        enrolledAt: enrolledAt,
        expiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(schema.orders.id, orderId),
      columns: { id: true, enrolledAt: true, expiresAt: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Enrollment date updated successfully.',
      order: {
        id: updatedOrder?.id,
        enrolledAt: updatedOrder?.enrolledAt,
        expiresAt: updatedOrder?.expiresAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
