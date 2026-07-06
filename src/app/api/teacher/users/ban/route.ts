import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTeacherPayload } from '@/lib/route-auth';
import { eq, and, or, inArray, desc, asc, isNull, sql } from 'drizzle-orm';
import * as schema from '@/db/schema';

export async function POST(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { userId, action } = await request.json();

    if (!userId || !action || (action !== 'ban' && action !== 'unban')) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    if (userId === payload.sub) {
      return NextResponse.json({ error: 'You cannot ban yourself.' }, { status: 400 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Protect administrative and teaching roles from being banned
    if (targetUser.role === 'admin' || targetUser.role === 'teacher') {
      return NextResponse.json({ error: 'You cannot ban other administrators or teachers.' }, { status: 403 });
    }

    const isBanned = action === 'ban';

    await db.update(schema.users).set({ isBanned }).where(eq(schema.users.id, userId));

    return NextResponse.json({ success: true, isBanned });
  } catch (error: any) {
    console.error('[User Ban API Error]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
