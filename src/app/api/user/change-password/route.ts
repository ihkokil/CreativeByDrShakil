import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth';

export async function POST(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new passwords are required.' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'New password must be different from current password.' }, { status: 400 });
    }

    // Query user and check current password hash in database
    const results = await db.$queryRaw<any[]>`
      SELECT 
        id, "passwordHash",
        ("passwordHash" = crypt(${currentPassword}, "passwordHash")) as "isCurrentValid"
      FROM "User" 
      WHERE id = ${payload.sub} 
      LIMIT 1
    `;

    const user = results[0];

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'This account is linked to Google. Please use Google Sign-in instead of a password.' },
        { status: 400 }
      );
    }

    if (!user.isCurrentValid) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
    }

    // Hash and update to the new password in DB
    await db.$executeRaw`
      UPDATE "User"
      SET 
        "passwordHash" = crypt(${newPassword}, gen_salt('bf', 12)),
        "passwordResetTokenHash" = NULL,
        "passwordResetExpires" = NULL
      WHERE id = ${user.id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
