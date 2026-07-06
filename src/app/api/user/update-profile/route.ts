import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userSchema } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    const { fullName, phone, bmdcNumber, profileImage } = await request.json();

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const [user] = await db.update(userSchema)
      .set({
        fullName,
        phone: phone || null,
        bmdcNumber: bmdcNumber || null,
        profileImage: profileImage || null,
      })
      .where(eq(userSchema.id, payload.sub))
      .returning({
        id: userSchema.id,
        email: userSchema.email,
        phone: userSchema.phone,
        role: userSchema.role,
        fullName: userSchema.fullName,
        bmdcNumber: userSchema.bmdcNumber,
        profileImage: userSchema.profileImage,
      });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        user_metadata: {
          full_name: user.fullName,
          phone: user.phone,
          bmdc_number: user.bmdcNumber,
          profile_image: user.profileImage,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
