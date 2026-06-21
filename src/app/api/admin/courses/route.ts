import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractBearerToken, extractCookieToken, verifyAuthToken } from '@/lib/auth-server';

export async function GET(request: NextRequest) {
  try {
    const bearerToken = extractBearerToken(request);
    const cookieToken = await extractCookieToken();
    const token = bearerToken || cookieToken;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const payload = await verifyAuthToken(token);
    if (payload.role !== 'admin' && payload.role !== 'teacher') {
      return NextResponse.json({ error: 'Forbidden: Admin or Teacher access required.' }, { status: 403 });
    }

    const courses = await prisma.course.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        price: true,
        instructor: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({
      courses: courses.map((course: any) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        status: course.status,
        price: course.price,
        instructor: course.instructor,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
