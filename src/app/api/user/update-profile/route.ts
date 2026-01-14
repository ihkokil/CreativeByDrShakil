import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = verifyAuthToken(token);
    const { fullName, phone } = await request.json();

    if (!fullName) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: payload.sub },
      data: {
        fullName,
        phone: phone || null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        fullName: true,
        bmdcNumber: true,
      },
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
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
