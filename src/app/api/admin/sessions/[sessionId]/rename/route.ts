import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-server';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { db } from '@/lib/db';

/**
 * PUT /api/admin/sessions/[sessionId]/rename
 * Rename the device label of a specific session
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { deviceLabel } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!deviceLabel || typeof deviceLabel !== 'string') {
      return NextResponse.json({ error: 'deviceLabel is required and must be a string' }, { status: 400 });
    }

    await db.update(schema.deviceSessions).set({ deviceLabel }).where(eq(schema.deviceSessions.id, sessionId));

    return NextResponse.json({
      success: true,
      message: 'Session device label updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
