import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';

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

    const targetUser = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Protect administrative and teaching roles from being banned
    if (targetUser.role === 'admin' || targetUser.role === 'teacher') {
      return NextResponse.json({ error: 'You cannot ban other administrators or teachers.' }, { status: 403 });
    }

    const isBanned = action === 'ban';

    await db.update(user)
      .set({ isBanned })
      .where(eq(user.id, userId));

    return NextResponse.json({ success: true, isBanned });
  } catch (error: any) {
    console.error('[User Ban API Error]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
